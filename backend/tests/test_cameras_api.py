from datetime import datetime

from app.api import cameras
from app.models.database import Camera


def _camera(cid: int = 1):
    cam = Camera(id=cid, name=f"cam-{cid}", latitude=35.0, longitude=139.0, is_active=True)
    cam.created_at = datetime(2025, 1, 1)
    cam.updated_at = None
    return cam


def test_list_cameras_returns_collection(build_test_client, fake_db, fake_user):
    fake_db.set_query_result("Camera", [_camera(1), _camera(2)])
    client = build_test_client(cameras.router, fake_db, user=fake_user)

    res = client.get("/api/v1/cameras")

    assert res.status_code == 200
    assert res.json()["total"] == 2
    assert len(res.json()["cameras"]) == 2


def test_get_camera_404_when_missing(build_test_client, fake_db):
    client = build_test_client(cameras.router, fake_db)

    res = client.get("/api/v1/cameras/99")

    assert res.status_code == 404


def test_create_update_delete_camera_flow(build_test_client, fake_db):
    cam = _camera(1)
    fake_db.set_query_result("Camera", [cam])
    client = build_test_client(cameras.router, fake_db)

    create_res = client.post(
        "/api/v1/cameras",
        json={
            "name": "new cam",
            "latitude": 35.1,
            "longitude": 139.2,
            "description": "desc",
            "is_active": True,
        },
    )
    assert create_res.status_code == 201

    update_res = client.put("/api/v1/cameras/1", json={"name": "updated", "latitude": 36.0})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "updated"

    delete_res = client.delete("/api/v1/cameras/1")
    assert delete_res.status_code == 204
    assert fake_db.deleted
