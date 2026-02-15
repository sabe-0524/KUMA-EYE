from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from app.api import streams
from app.core.auth import FirebaseUser, get_current_user
from app.core.config import settings
from app.core.database import get_db


class FakeQuery:
    def __init__(self, first_value=None):
        self._first_value = first_value

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._first_value


class FakeDB:
    def __init__(self, camera=None):
        self.camera = camera
        self.upload = None
        self._next_id = 1

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "Camera":
            return FakeQuery(first_value=self.camera)
        if name == "Upload":
            return FakeQuery(first_value=self.upload)
        return FakeQuery()

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1
        if getattr(obj, "__class__", None).__name__ == "Upload":
            self.upload = obj

    def commit(self):
        return None

    def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = self._next_id
            self._next_id += 1
        if getattr(obj, "__class__", None).__name__ == "Upload":
            self.upload = obj


def _build_client(fake_db, monkeypatch):
    app = FastAPI()
    app.include_router(streams.router, prefix=settings.API_V1_PREFIX)

    def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: FirebaseUser(
        uid="stream-user",
        email="stream@example.com",
        name="stream",
    )

    streams.stream_session_manager.reset()
    return TestClient(app)


def _jpeg_bytes() -> bytes:
    image = Image.new("RGB", (16, 16), color="white")
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_create_stream_session_returns_201(monkeypatch):
    client = _build_client(FakeDB(), monkeypatch)

    response = client.post(
        "/api/v1/streams/sessions",
        json={
            "latitude": 35.6812,
            "longitude": 139.7671,
            "frame_interval": 5,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "active"
    assert isinstance(payload["session_id"], str)
    assert isinstance(payload["upload_id"], int)


def test_upload_stream_frame_and_stop(monkeypatch):
    client = _build_client(FakeDB(), monkeypatch)

    monkeypatch.setattr(
        streams,
        "process_stream_frame",
        lambda *args, **kwargs: {
            "detections_count": 1,
            "sighting_id": 1,
            "alert_id": 2,
            "alert_level": "warning",
        },
    )

    session_res = client.post(
        "/api/v1/streams/sessions",
        json={"latitude": 35.0, "longitude": 139.0, "frame_interval": 5},
    )
    session_id = session_res.json()["session_id"]

    frame_res = client.post(
        f"/api/v1/streams/sessions/{session_id}/frames",
        files={"frame_file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
        data={"frame_number": "0"},
    )
    assert frame_res.status_code == 200
    assert frame_res.json()["detections_count"] == 1

    stop_res = client.post(f"/api/v1/streams/sessions/{session_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.json()["session"]["status"] == "stopped"


def test_upload_stream_frame_returns_404_for_unknown_session(monkeypatch):
    client = _build_client(FakeDB(), monkeypatch)

    response = client.post(
        "/api/v1/streams/sessions/missing-session/frames",
        files={"frame_file": ("frame.jpg", _jpeg_bytes(), "image/jpeg")},
        data={"frame_number": "0"},
    )

    assert response.status_code == 404


def test_get_stream_session_status(monkeypatch):
    client = _build_client(FakeDB(), monkeypatch)

    session_res = client.post(
        "/api/v1/streams/sessions",
        json={"latitude": 35.0, "longitude": 139.0, "frame_interval": 5},
    )
    session_id = session_res.json()["session_id"]

    response = client.get(f"/api/v1/streams/sessions/{session_id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == session_id
    assert payload["status"] == "active"


def test_upload_stream_frame_rejects_invalid_image(monkeypatch):
    client = _build_client(FakeDB(), monkeypatch)

    session_res = client.post(
        "/api/v1/streams/sessions",
        json={"latitude": 35.0, "longitude": 139.0, "frame_interval": 5},
    )
    session_id = session_res.json()["session_id"]

    response = client.post(
        f"/api/v1/streams/sessions/{session_id}/frames",
        files={"frame_file": ("frame.jpg", b"invalid-image", "image/jpeg")},
        data={"frame_number": "0"},
    )

    assert response.status_code == 400
