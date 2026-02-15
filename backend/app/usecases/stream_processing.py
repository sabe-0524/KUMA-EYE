"""Stream frame processing use case."""

from __future__ import annotations

from datetime import datetime
import logging

from PIL import Image
from sqlalchemy.orm import Session

from app.models.database import Camera, Upload
from app.services.detection import get_detection_service
from app.services.notification_service import NOTIFIABLE_ALERT_LEVELS, notify_for_alert
from app.services.stream_session_manager import StreamSession
from app.services.video_processor import get_video_processor
from app.usecases.detection_persistence import save_detection_result

logger = logging.getLogger(__name__)


def process_stream_frame(
    db: Session,
    *,
    session: StreamSession,
    frame_number: int,
    frame_image: Image.Image,
    captured_at: datetime | None = None,
) -> dict:
    """Process a single frame from a live stream session."""
    upload = db.query(Upload).filter(Upload.id == session.upload_id).first()
    if not upload:
        raise ValueError(f"Upload with id {session.upload_id} not found")

    detection_service = get_detection_service()
    video_processor = get_video_processor(session.frame_interval)
    latitude, longitude, camera_name = _resolve_stream_location(db, upload)

    upload.status = "processing"
    upload.frame_count = (upload.frame_count or 0) + 1
    upload.processed_at = datetime.now()

    detections = detection_service.detect(frame_image)
    if not detections:
        db.commit()
        return {
            "detections_count": 0,
            "sighting_id": None,
            "alert_id": None,
            "alert_level": None,
        }

    sighting_id, alert_id, alert_level = save_detection_result(
        db=db,
        upload=upload,
        frame_number=frame_number,
        detections=detections,
        latitude=latitude,
        longitude=longitude,
        camera_name=camera_name,
        detection_service=detection_service,
        video_processor=video_processor,
        frame_image=frame_image,
        detected_at=captured_at,
    )
    db.commit()

    if (not session.notification_dispatched) and alert_level in NOTIFIABLE_ALERT_LEVELS:
        try:
            notify_for_alert(db, alert_id)
            session.notification_dispatched = True
        except Exception:
            db.rollback()
            logger.exception("Notification failed for stream session=%s alert_id=%s", session.session_id, alert_id)

    return {
        "detections_count": len(detections),
        "sighting_id": sighting_id,
        "alert_id": alert_id,
        "alert_level": alert_level,
    }


def _resolve_stream_location(db: Session, upload: Upload) -> tuple[float, float, str | None]:
    camera = None
    if upload.camera_id:
        camera = db.query(Camera).filter(Camera.id == upload.camera_id).first()

    if camera:
        return float(camera.latitude), float(camera.longitude), camera.name

    latitude = float(upload.latitude) if upload.latitude is not None else 0.0
    longitude = float(upload.longitude) if upload.longitude is not None else 0.0
    return latitude, longitude, None
