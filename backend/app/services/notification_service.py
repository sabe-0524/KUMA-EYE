"""
Notification Service (Email)
"""
from datetime import datetime, timedelta
import logging
from typing import List

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, cast
from geoalchemy2 import Geography

from app.core.config import settings
from app.core.auth import FirebaseUser
from firebase_admin import auth as firebase_auth
from app.models.database import User, Alert, AlertNotification, Sighting
from app.services.email_service import get_email_service

logger = logging.getLogger(__name__)

def get_or_create_user(db: Session, firebase_user: FirebaseUser) -> User:
    resolved_email = firebase_user.email
    resolved_name = firebase_user.name

    if not resolved_email:
        try:
            fb_user = firebase_auth.get_user(firebase_user.uid)
            resolved_email = fb_user.email
            resolved_name = resolved_name or fb_user.display_name
        except Exception as exc:
            logger.warning(
                "get_or_create_user: failed to fetch firebase user (uid=%s): %s",
                firebase_user.uid,
                exc,
            )

    user = db.query(User).filter(User.firebase_uid == firebase_user.uid).first()

    if user:
        updated = False
        if resolved_email and user.email != resolved_email:
            user.email = resolved_email
            updated = True
        if resolved_name and user.display_name != resolved_name:
            user.display_name = resolved_name
            updated = True
        if updated:
            db.commit()
        return user

    user = User(
        firebase_uid=firebase_user.uid,
        email=resolved_email or None,
        display_name=resolved_name,
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
    try:
        alert = (
            db.query(Alert)
            .options(joinedload(Alert.sighting))
            .filter(Alert.id == alert_id)
            .first()
        )
        if not alert or not alert.sighting:
            logger.warning("notify_for_alert: alert or sighting missing (alert_id=%s)", alert_id)
            return 0

        sighting = alert.sighting
        if sighting.latitude is None or sighting.longitude is None:
            logger.warning("notify_for_alert: sighting lat/lng missing (alert_id=%s)", alert_id)
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

        sighting_point = func.ST_SetSRID(
            func.ST_MakePoint(float(sighting.longitude), float(sighting.latitude)), 4326
        )
        recipients = base_query.filter(
            func.ST_DWithin(
                cast(User.location, Geography),
                cast(sighting_point, Geography),
                settings.NOTIFY_RADIUS_METERS,
            )
        ).all()

        if not recipients:
            logger.info("notify_for_alert: no recipients (alert_id=%s)", alert_id)
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
            logger.warning("notify_for_alert: SMTP connect failed (alert_id=%s): %s", alert_id, exc)

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
                logger.warning(
                    "notify_for_alert: send failed (alert_id=%s user_id=%s): %s",
                    alert_id,
                    user.id,
                    exc,
                )

        if server:
            try:
                server.quit()
            except Exception:
                pass

        db.commit()
        logger.info("notify_for_alert: sent=%s (alert_id=%s)", sent_count, alert_id)
        return sent_count
    except Exception as exc:
        db.rollback()
        logger.warning("notify_for_alert: failed (alert_id=%s): %s", alert_id, exc)
        return 0
