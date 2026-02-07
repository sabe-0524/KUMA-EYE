from datetime import datetime

from app.core.config import settings
from app.models.database import Camera, Sighting, Upload
from app.presenters.image_url import build_image_url
from app.presenters.sightings import build_sighting_response


def test_build_image_url_uses_relative_storage_path(monkeypatch):
    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", "/storage")

    assert build_image_url("/storage/processed/1/frame.jpg") == "/api/v1/images/processed/1/frame.jpg"


def test_build_sighting_response_converts_numeric_fields(monkeypatch):
    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", "/storage")

    camera = Camera(id=1, name="Cam-A", latitude=35.0, longitude=139.0)
    upload = Upload(id=11, file_path="/tmp/x.jpg", file_type="image", status="pending")
    upload.camera = camera

    sighting = Sighting(
        id=20,
        upload_id=11,
        latitude=35.1,
        longitude=139.2,
        detected_at=datetime(2025, 1, 1, 10, 0, 0),
        confidence=0.91,
        bear_count=2,
        alert_level="critical",
        image_path="/storage/processed/11/detected_000001.jpg",
    )
    sighting.upload = upload
    sighting.created_at = datetime(2025, 1, 1, 10, 0, 10)

    response = build_sighting_response(sighting)

    assert response.id == 20
    assert response.camera is not None
    assert response.camera.name == "Cam-A"
    assert response.image_url == "/api/v1/images/processed/11/detected_000001.jpg"
    assert isinstance(response.latitude, float)
    assert isinstance(response.confidence, float)
