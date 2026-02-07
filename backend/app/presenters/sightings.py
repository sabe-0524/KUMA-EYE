"""Presenter for sighting-related API responses."""

from __future__ import annotations

from app.models.database import Sighting
from app.models.schemas import CameraSummary, SightingResponse
from app.presenters.image_url import build_image_url


def build_sighting_response(sighting: Sighting) -> SightingResponse:
    """Convert a Sighting ORM model into API response schema."""
    camera_summary = None
    if sighting.upload and sighting.upload.camera:
        camera_summary = CameraSummary(
            id=sighting.upload.camera.id,
            name=sighting.upload.camera.name,
        )

    return SightingResponse(
        id=sighting.id,
        latitude=float(sighting.latitude),
        longitude=float(sighting.longitude),
        detected_at=sighting.detected_at,
        confidence=float(sighting.confidence),
        bear_count=sighting.bear_count,
        alert_level=sighting.alert_level,
        image_url=build_image_url(sighting.image_path),
        camera=camera_summary,
        created_at=sighting.created_at,
    )
