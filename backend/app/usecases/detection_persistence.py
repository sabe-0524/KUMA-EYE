"""Shared persistence logic for detection results."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.database import Alert, Detection, Sighting, Upload
from app.services.detection import BearDetectionService
from app.services.video_processor import VideoProcessor


def save_detection_result(
    *,
    db: Session,
    upload: Upload,
    frame_number: int,
    detections: list[dict],
    latitude: float,
    longitude: float,
    camera_name: str | None,
    detection_service: BearDetectionService,
    video_processor: VideoProcessor,
    frame_image,
    detected_at: datetime | None = None,
) -> tuple[int, int, str]:
    """Persist sighting, detections and alert for a detected frame."""
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
        detected_at=detected_at or datetime.now(),
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
