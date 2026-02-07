"""
Bear Detection System - Alert Notification Service
"""
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.database import Alert, AlertNotification, Sighting, Upload, User
from app.presenters.image_url import build_image_url
from app.services.email_service import EmailAttachment, get_email_service
from app.services.geocoding_service import reverse_geocode

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


def _build_google_maps_url(latitude: float, longitude: float) -> str:
    return f"https://www.google.com/maps?q={latitude:.6f},{longitude:.6f}"


def _to_absolute_url(path_or_url: str | None) -> str | None:
    if not path_or_url:
        return None
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    return f"{settings.APP_BASE_URL.rstrip('/')}/{path_or_url.lstrip('/')}"


def _format_address(latitude: float, longitude: float) -> str:
    address = reverse_geocode(latitude, longitude)
    if not address:
        return "取得失敗（緯度経度を参照）"

    parts = [part for part in (address.prefecture, address.municipality) if part]
    if not parts:
        return "取得失敗（緯度経度を参照）"
    return " ".join(parts)


def _build_image_attachment(sighting: Sighting | None) -> EmailAttachment | None:
    if not sighting or not sighting.image_path:
        return None

    try:
        image_path = Path(sighting.image_path).resolve()
        storage_root = Path(settings.LOCAL_STORAGE_PATH).resolve()
    except Exception:
        return None

    if storage_root not in image_path.parents:
        logger.warning("Skip attachment outside storage root: %s", image_path)
        return None

    if not image_path.exists() or not image_path.is_file():
        return None

    if image_path.stat().st_size > settings.EMAIL_ATTACHMENT_MAX_BYTES:
        logger.warning("Skip oversized attachment: %s", image_path)
        return None

    suffix = image_path.suffix.lower()
    mime_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    mime_type = mime_type_map.get(suffix)
    if not mime_type:
        return None

    try:
        return EmailAttachment(
            filename=image_path.name,
            content=image_path.read_bytes(),
            mime_type=mime_type,
        )
    except Exception:
        logger.exception("Failed to read attachment image: %s", image_path)
        return None


def _build_email_body(alert: Alert, image_url: str | None, has_attachment: bool) -> str:
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
        latitude = float(sighting.latitude)
        longitude = float(sighting.longitude)
        address_text = _format_address(latitude, longitude)
        map_url = _build_google_maps_url(latitude, longitude)
        lines.extend(
            [
                f"検出時刻: {sighting.detected_at.isoformat()}",
                f"住所: {address_text}",
                f"位置: 緯度 {latitude:.6f}, 経度 {longitude:.6f}",
                f"地図: {map_url}",
                f"検出数: {sighting.bear_count}頭",
                f"信頼度: {float(sighting.confidence) * 100:.1f}%",
                f"カメラ: {camera_name}",
            ]
        )
        if has_attachment:
            lines.append("検出画像: このメールに添付しています。")
        elif image_url:
            lines.append(f"検出画像: {image_url}")

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


def _try_lock_notification_slot(db: Session, alert_id: int, user_id: int) -> bool:
    """
    同一(alert_id, user_id)の通知送信を排他するため、トランザクションスコープのadvisory lockを取得する。
    """
    lock_key = (int(alert_id) << 32) | int(user_id)
    locked = db.execute(
        select(func.pg_try_advisory_xact_lock(lock_key))
    ).scalar_one()
    return bool(locked)


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

    existing_user_ids = {
        user_id
        for (user_id,) in (
            db.query(AlertNotification.user_id)
            .filter(AlertNotification.alert_id == alert.id)
            .filter(AlertNotification.channel == "email")
            .all()
        )
    }

    email_service = get_email_service()
    subject = _build_email_subject(alert.alert_level)
    attachment = _build_image_attachment(alert.sighting)
    image_url = _to_absolute_url(build_image_url(alert.sighting.image_path) if alert.sighting else None)
    body = _build_email_body(alert, image_url=image_url, has_attachment=attachment is not None)
    attachments = [attachment] if attachment else None

    for user in recipients:
        if user.id in existing_user_ids:
            stats["skipped"] += 1
            continue

        if not _try_lock_notification_slot(db, alert.id, user.id):
            stats["skipped"] += 1
            continue

        try:
            email_service.send_email(user.email, subject, body, attachments=attachments)
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
            existing_user_ids.add(user.id)
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
