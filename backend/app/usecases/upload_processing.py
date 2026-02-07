"""Upload processing use case for video/image/frame inputs."""

from __future__ import annotations

from datetime import datetime
import logging
import shutil
from typing import Iterator

from PIL import Image, UnidentifiedImageError
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.database import Alert, Camera, Detection, Sighting, Upload
from app.services.detection import BearDetectionService, get_detection_service
from app.services.notification_service import NOTIFIABLE_ALERT_LEVELS, notify_for_alert
from app.services.video_processor import VideoProcessor, get_video_processor

logger = logging.getLogger(__name__)


def execute_upload_processing(
    db: Session,
    upload_id: int,
    frame_interval: int,
    frames_dir: str | None = None,
) -> dict:
    """Execute upload processing and persist detection results."""
    upload = _get_upload(db, upload_id)
    if not upload:
        logger.error("Upload %s not found", upload_id)
        return {"status": "failed", "upload_id": upload_id, "error": "Upload not found"}

    upload.status = "processing"
    upload.error_message = None
    db.commit()

    detection_service = get_detection_service()
    video_processor = get_video_processor(frame_interval)
    latitude, longitude, camera_name = _resolve_location(db, upload)

    frame_count = 0
    sighting_ids: list[int] = []
    notification_dispatched = False

    try:
        frame_iterator = _build_frame_iterator(
            upload=upload,
            frames_dir=frames_dir,
            video_processor=video_processor,
        )

        if upload.file_type == "video" and not frames_dir:
            video_info = video_processor.get_video_info(upload.file_path)
            upload.duration_seconds = int(video_info.get("duration", 0)) if video_info else 0
            db.commit()

        for frame_number, frame_image in frame_iterator:
            frame_count += 1
            detections = detection_service.detect(frame_image)

            if not detections:
                continue

            sighting_id, alert_id, alert_level = _save_detection_result(
                db=db,
                upload=upload,
                frame_number=frame_number,
                frame_image=frame_image,
                detections=detections,
                latitude=latitude,
                longitude=longitude,
                camera_name=camera_name,
                detection_service=detection_service,
                video_processor=video_processor,
            )
            db.commit()
            sighting_ids.append(sighting_id)

            if not notification_dispatched and alert_level in NOTIFIABLE_ALERT_LEVELS:
                try:
                    notify_for_alert(db, alert_id)
                    notification_dispatched = True
                except Exception:
                    db.rollback()
                    logger.exception("Notification failed for alert_id=%s", alert_id)

        upload.status = "completed"
        upload.frame_count = frame_count
        upload.processed_at = datetime.now()

        if frames_dir:
            upload.duration_seconds = frame_count * frame_interval if frame_interval else None

        db.commit()

        return {
            "status": "completed",
            "upload_id": upload_id,
            "sightings_count": len(sighting_ids),
            "sighting_ids": sighting_ids,
            "frame_count": frame_count,
        }
    except Exception as exc:
        logger.exception("Error processing upload %s", upload_id)
        db.rollback()
        _mark_upload_failed(db, upload_id, str(exc))
        return {"status": "failed", "upload_id": upload_id, "error": str(exc)}
    finally:
        if frames_dir:
            shutil.rmtree(frames_dir, ignore_errors=True)


def _get_upload(db: Session, upload_id: int) -> Upload | None:
    return db.query(Upload).filter(Upload.id == upload_id).first()


def _resolve_location(db: Session, upload: Upload) -> tuple[float, float, str | None]:
    camera = None
    if upload.camera_id:
        camera = db.query(Camera).filter(Camera.id == upload.camera_id).first()

    if camera:
        return float(camera.latitude), float(camera.longitude), camera.name

    latitude = float(upload.latitude) if upload.latitude is not None else 0.0
    longitude = float(upload.longitude) if upload.longitude is not None else 0.0
    return latitude, longitude, None


def _build_frame_iterator(
    upload: Upload,
    frames_dir: str | None,
    video_processor: VideoProcessor,
) -> Iterator[tuple[int, Image.Image]]:
    if frames_dir:
        return _iter_directory_frames(video_processor, frames_dir)

    if upload.file_type == "video":
        return _iter_video_frames(video_processor, upload.file_path)

    return _iter_single_image(upload.file_path)


def _iter_video_frames(
    video_processor: VideoProcessor,
    file_path: str,
) -> Iterator[tuple[int, Image.Image]]:
    for frame_number, _, pil_image in video_processor.extract_frames(file_path):
        yield frame_number, pil_image


def _iter_single_image(file_path: str) -> Iterator[tuple[int, Image.Image]]:
    with Image.open(file_path) as image:
        yield 0, image.copy()


def _iter_directory_frames(
    video_processor: VideoProcessor,
    frames_dir: str,
) -> Iterator[tuple[int, Image.Image]]:
    frame_paths = video_processor.list_frame_files(frames_dir)

    for frame_number, frame_path in enumerate(frame_paths):
        try:
            with Image.open(frame_path) as image:
                yield frame_number, image.copy()
        except (UnidentifiedImageError, OSError):
            logger.warning("Skipping unreadable frame: %s", frame_path)


def _save_detection_result(
    db: Session,
    upload: Upload,
    frame_number: int,
    frame_image: Image.Image,
    detections: list[dict],
    latitude: float,
    longitude: float,
    camera_name: str | None,
    detection_service: BearDetectionService,
    video_processor: VideoProcessor,
) -> tuple[int, int, str]:
    max_confidence = max(d["confidence"] for d in detections)
    bear_count = len(detections)

    alert_level = detection_service.calculate_alert_level(detections)
    if not alert_level:
        alert_level = "warning" if max_confidence >= 0.7 else "caution"

    annotated_image = detection_service.draw_detections(frame_image, detections)
    processed_path = video_processor.save_processed_frame(
        annotated_image,
        upload.id,
        frame_number,
    )

    sighting = Sighting(
        upload_id=upload.id,
        location=func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
        latitude=latitude,
        longitude=longitude,
        detected_at=datetime.now(),
        confidence=max_confidence,
        bear_count=bear_count,
        alert_level=alert_level,
        image_path=processed_path,
        frame_number=frame_number,
    )
    db.add(sighting)
    db.flush()

    for det in detections:
        detection = Detection(
            sighting_id=sighting.id,
            class_name=det["class_name"],
            confidence=det["confidence"],
            bbox_x=det["bbox"]["x"],
            bbox_y=det["bbox"]["y"],
            bbox_w=det["bbox"]["width"],
            bbox_h=det["bbox"]["height"],
        )
        db.add(detection)

    alert_message = detection_service.create_alert_message(
        detections,
        alert_level,
        camera_name=camera_name,
        location=(latitude, longitude),
    )
    alert = Alert(
        sighting_id=sighting.id,
        alert_level=alert_level,
        message=alert_message,
    )
    db.add(alert)
    db.flush()

    return sighting.id, alert.id, alert_level


def _mark_upload_failed(db: Session, upload_id: int, error_message: str) -> None:
    try:
        upload = _get_upload(db, upload_id)
        if not upload:
            return

        upload.status = "failed"
        upload.error_message = error_message[:2000]
        upload.processed_at = datetime.now()
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to set upload failed status: upload_id=%s", upload_id)
