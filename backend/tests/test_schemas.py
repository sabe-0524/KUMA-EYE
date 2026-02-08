from datetime import datetime

import pytest
from pydantic import ValidationError

from app.models.schemas import (
    CameraCreate,
    UploadCreate,
    UserLocationUpdate,
    SightingStatistics,
)


def test_camera_create_validation_success():
    obj = CameraCreate(name="cam", latitude=35.0, longitude=139.0, is_active=True)
    assert obj.name == "cam"


def test_camera_create_validation_error():
    with pytest.raises(ValidationError):
        CameraCreate(name="cam", latitude=120.0, longitude=139.0, is_active=True)


def test_upload_create_default_interval():
    obj = UploadCreate(latitude=35.0, longitude=139.0)
    assert obj.frame_interval == 5


def test_user_location_update_validation_error():
    with pytest.raises(ValidationError):
        UserLocationUpdate(latitude=0.0, longitude=500.0)


def test_sighting_statistics_schema():
    obj = SightingStatistics(
        total_sightings=1,
        sightings_by_level={"warning": 1},
        sightings_today=1,
        sightings_this_week=1,
        average_confidence=0.7,
    )
    assert obj.sightings_by_level["warning"] == 1
