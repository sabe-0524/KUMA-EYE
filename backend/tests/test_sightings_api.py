from datetime import datetime

from app.api import sightings
from app.models.database import Sighting, Upload


def _sighting(sid: int = 1):
    upload = Upload(id=11, file_path="/tmp/x.jpg", file_type="image", status="completed")
    item = Sighting(
        id=sid,
        upload_id=11,
        latitude=35.0,
        longitude=139.0,
        detected_at=datetime(2025, 1, 1, 10, 0, 0),
        confidence=0.8,
        bear_count=1,
        alert_level="warning",
        image_path="/tmp/x.jpg",
    )
    item.created_at = datetime(2025, 1, 1, 10, 0, 1)
    item.upload = upload
    item.detections = []
    return item


def test_list_sightings_success(build_test_client, fake_db):
    fake_db.set_query_result("Sighting", [_sighting(1), _sighting(2)])
    client = build_test_client(sightings.router, fake_db)

    res = client.get("/api/v1/sightings")

    assert res.status_code == 200
    assert res.json()["total"] == 2


def test_list_sightings_invalid_bounds(build_test_client, fake_db):
    client = build_test_client(sightings.router, fake_db)

    res = client.get("/api/v1/sightings", params={"bounds": "bad"})

    assert res.status_code == 400


def test_get_statistics(build_test_client, fake_db):
    q = [_sighting(1), _sighting(2)]
    fake_db.set_query_result("Sighting", q)
    fake_db.set_query_result(str(Sighting.alert_level), [("warning", 2)])
    client = build_test_client(sightings.router, fake_db)

    res = client.get("/api/v1/sightings/statistics")

    assert res.status_code == 200
    assert "total_sightings" in res.json()


def test_get_sighting_404(build_test_client, fake_db):
    client = build_test_client(sightings.router, fake_db)

    res = client.get("/api/v1/sightings/1")

    assert res.status_code == 404
