"""
Bear Detection System - Alert Notification Service
"""
import logging
from datetime import datetime, timedelta
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import cast, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.database import Alert, AlertNotification, Sighting, Upload, User
from app.services.email_service import get_email_service

logger = logging.getLogger(__name__)

NOTIFIABLE_ALERT_LEVELS = {"critical", "warning", "caution"}


def _build_email_subject(alert_level: str) -> str:
    level_labels = {
        "critical": "危険",
        "warning": "警戒",
        "caution": "注意",
    }
    level_label = level_labels.get(alert_level, "通知")
    return f"[KUMA-EYE] {level_label} クマ検出アラート"


def _build_email_body(alert: Alert) -> str:
    sighting = alert.sighting
    upload = sighting.upload if sighting else None
    camera = upload.camera if upload else None
    camera_name = camera.name if camera else "指定地点"

    lines = [
        "クマ検出アラートを受信しました。",
        "",
        f"レベル: {alert.alert_level}",
        f"内容: {alert.message}",
    ]

    if sighting:
        lines.extend(
            [
                f"検出時刻: {sighting.detected_at.isoformat()}",
                f"位置: 緯度 {float(sighting.latitude):.6f}, 経度 {float(sighting.longitude):.6f}",
                f"検出数: {sighting.bear_count}頭",
                f"信頼度: {float(sighting.confidence) * 100:.1f}%",
                f"カメラ: {camera_name}",
            ]
        )

    lines.extend(["", "このメールはKUMA-EYE通知システムから自動送信されています。"])
    return "\n".join(lines)


def _get_alert(db: Session, alert_id: int) -> Alert | None:
    return (
        db.query(Alert)
        .options(
            joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
        )
        .filter(Alert.id == alert_id)
        .first()
    )


def _get_nearby_recipients(db: Session, alert: Alert) -> list[User]:
    if not alert.sighting:
        return []

    stale_threshold = datetime.now() - timedelta(minutes=settings.NOTIFY_STALE_MINUTES)
    alert_point = func.ST_SetSRID(
        func.ST_MakePoint(alert.sighting.longitude, alert.sighting.latitude),
        4326,
    )

    return (
        db.query(User)
        .filter(User.email_opt_in.is_(True))
        .filter(User.email.isnot(None))
        .filter(User.email != "")
        .filter(User.location.isnot(None))
        .filter(User.location_updated_at.isnot(None))
        .filter(User.location_updated_at >= stale_threshold)
        .filter(
            func.ST_DWithin(
                cast(User.location, Geography),
                cast(alert_point, Geography),
                settings.NOTIFY_RADIUS_METERS,
            )
        )
        .all()
    )


def notify_for_alert(db: Session, alert_id: int) -> dict[str, Any]:
    """
    指定アラートに対して近傍ユーザーへメール通知する
    """
    stats: dict[str, Any] = {
        "alert_id": alert_id,
        "processed": False,
        "eligible": False,
        "targets": 0,
        "sent": 0,
        "failed": 0,
        "skipped": 0,
    }

    alert = _get_alert(db, alert_id)
    if not alert:
        logger.warning("Alert not found for notification: alert_id=%s", alert_id)
        return stats

    stats["processed"] = True
    if alert.alert_level not in NOTIFIABLE_ALERT_LEVELS:
        return stats
    stats["eligible"] = True

    recipients = _get_nearby_recipients(db, alert)
    stats["targets"] = len(recipients)
    if not recipients:
        return stats

    email_service = get_email_service()
    subject = _build_email_subject(alert.alert_level)
    body = _build_email_body(alert)

    for user in recipients:
        exists = (
            db.query(AlertNotification.id)
            .filter(AlertNotification.alert_id == alert.id)
            .filter(AlertNotification.user_id == user.id)
            .filter(AlertNotification.channel == "email")
            .first()
        )
        if exists:
            stats["skipped"] += 1
            continue

        try:
            email_service.send_email(user.email, subject, body)
            notification = AlertNotification(
                alert_id=alert.id,
                user_id=user.id,
                channel="email",
                status="sent",
                sent_at=datetime.now(),
            )
            db.add(notification)
            db.commit()
            stats["sent"] += 1
        except Exception as exc:
            db.rollback()
            logger.exception(
                "Failed to send notification email. alert_id=%s user_id=%s",
                alert.id,
                user.id,
            )
            failure = AlertNotification(
                alert_id=alert.id,
                user_id=user.id,
                channel="email",
                status="failed",
                error_message=str(exc)[:2000],
            )
            try:
                db.add(failure)
                db.commit()
            except IntegrityError:
                db.rollback()
                stats["skipped"] += 1
            else:
                stats["failed"] += 1

    return stats
