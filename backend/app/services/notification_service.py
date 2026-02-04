"""
Notification Service (Email)
"""
from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast
from geoalchemy2 import Geography

from app.core.config import settings
from app.core.auth import FirebaseUser
from app.models.database import User, Alert, AlertNotification, Sighting
from app.services.email_service import get_email_service


def get_or_create_user(db: Session, firebase_user: FirebaseUser) -> User:
    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()

    if user:
        updated = False
        if firebase_user.email and user.email != firebase_user.email:
            user.email = firebase_user.email
            updated = True
        if firebase_user.name and user.display_name != firebase_user.name:
            user.display_name = firebase_user.name
            updated = True
        if updated:
            db.commit()
        return user

    user = User(
        firebase_uid=firebase_user.uid,
        email=firebase_user.email or None,
        display_name=firebase_user.name,
        email_opt_in=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_notification_settings(db: Session, user: User, email_opt_in: bool) -> User:
    user.email_opt_in = email_opt_in
    db.commit()
    db.refresh(user)
    return user


def update_location(db: Session, user: User, latitude: float, longitude: float) -> User:
    user.latitude = latitude
    user.longitude = longitude
    user.location = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    user.location_updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def _alert_subject(alert_level: str) -> str:
    level_labels = {
        "critical": "危険",
        "warning": "警戒",
        "caution": "注意",
        "low": "情報",
    }
    label = level_labels.get(alert_level, "通知")
    return f"【熊検出通知】{label}"


def _alert_body(alert: Alert, sighting: Sighting) -> str:
    lines: List[str] = [
        "熊の検出を通知します。",
        "",
        f"レベル: {alert.alert_level}",
        f"検出日時: {sighting.detected_at}",
        f"位置: 緯度 {float(sighting.latitude):.6f}, 経度 {float(sighting.longitude):.6f}",
        f"詳細: {alert.message}",
    ]
    if settings.APP_BASE_URL:
        lines.append("")
        lines.append(f"地図を見る: {settings.APP_BASE_URL}")
    return "\n".join(lines)


def notify_for_alert(db: Session, alert_id: int) -> int:
    alert = (
        db.query(Alert)
        .options(joinedload(Alert.sighting))
        .filter(Alert.id == alert_id)
        .first()
    )
    if not alert or not alert.sighting:
        return 0

    sighting = alert.sighting
    if sighting.location is None:
        return 0

    cutoff = datetime.utcnow() - timedelta(minutes=settings.NOTIFY_STALE_MINUTES)
    base_query = db.query(User).filter(
        User.email_opt_in == True,
        User.email.isnot(None),
        User.email != "",
        User.location.isnot(None),
        User.location_updated_at.isnot(None),
        User.location_updated_at >= cutoff,
    )

    notified_user_ids = [
        row[0]
        for row in db.query(AlertNotification.user_id)
        .filter(
            AlertNotification.alert_id == alert_id,
            AlertNotification.channel == "email",
        )
        .all()
    ]

    if notified_user_ids:
        base_query = base_query.filter(~User.id.in_(notified_user_ids))

    recipients = base_query.filter(
        func.ST_DWithin(
            cast(User.location, Geography),
            cast(sighting.location, Geography),
            settings.NOTIFY_RADIUS_METERS,
        )
    ).all()

    if not recipients:
        return 0

    email_service = get_email_service()
    subject = _alert_subject(alert.alert_level)
    body = _alert_body(alert, sighting)

    sent_count = 0
    server = None
    connect_error = None

    try:
        server = email_service.connect()
    except Exception as exc:
        connect_error = exc

    for user in recipients:
        notification = AlertNotification(
            alert_id=alert.id,
            user_id=user.id,
            channel="email",
            status="pending",
        )
        db.add(notification)
        db.flush()

        try:
            if connect_error:
                raise connect_error
            if not user.email:
                raise RuntimeError("User email is missing")
            email_service.send_with_server(server, user.email, subject, body)
            notification.status = "sent"
            notification.sent_at = datetime.utcnow()
            sent_count += 1
        except Exception as exc:
            notification.status = "failed"
            notification.error_message = str(exc)

    if server:
        try:
            server.quit()
        except Exception:
            pass

    db.commit()
    return sent_count
