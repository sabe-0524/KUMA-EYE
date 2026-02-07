from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import uploads
from app.core.auth import FirebaseUser, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.database import Upload


class FakeQuery:
    def __init__(self, first_value=None, count_value=0, all_values=None):
        self._first_value = first_value
        self._count_value = count_value
        self._all_values = all_values or []

    def filter(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def all(self):
        return self._all_values

    def first(self):
        return self._first_value

    def count(self):
        return self._count_value


class FakeDB:
    def __init__(self, upload=None, sighting_count=0, camera=None):
        self.upload = upload
        self.sighting_count = sighting_count
        self.camera = camera
        self._next_id = 1

    def query(self, model):
        name = model.__name__
        if name == "Upload":
            return FakeQuery(first_value=self.upload)
        if name == "Sighting":
            return FakeQuery(count_value=self.sighting_count)
        if name == "Camera":
            return FakeQuery(first_value=self.camera)
        return FakeQuery()

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            setattr(obj, "id", self._next_id)
            self._next_id += 1

    def commit(self):
        return None

    def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            setattr(obj, "id", self._next_id)
            self._next_id += 1


def _build_client(fake_db, monkeypatch, tmp_path):
    app = FastAPI()
    app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)

    def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: FirebaseUser(
        uid="test-user",
        email="test@example.com",
        name="tester",
    )

    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(uploads, "enqueue_upload_processing", lambda *args, **kwargs: None)

    return TestClient(app)


def test_create_upload_returns_202_and_response_schema(monkeypatch, tmp_path):
    client = _build_client(FakeDB(), monkeypatch, tmp_path)

    response = client.post(
        "/api/v1/uploads",
        files={"file": ("sample.jpg", b"fake-image-bytes", "image/jpeg")},
        data={
            "latitude": "35.681236",
            "longitude": "139.767125",
            "frame_interval": "5",
        },
    )

    assert response.status_code == 202
    payload = response.json()

    assert set(payload.keys()) == {
        "upload_id",
        "status",
        "message",
        "estimated_time_seconds",
    }
    assert payload["status"] == "processing"
    assert isinstance(payload["upload_id"], int)

    saved_files = list((tmp_path / "images").glob("*"))
    assert len(saved_files) == 1


def test_create_frame_upload_rejects_non_zip(monkeypatch, tmp_path):
    client = _build_client(FakeDB(), monkeypatch, tmp_path)

    response = client.post(
        "/api/v1/uploads/frames",
        files={"zip_file": ("frames.txt", b"not-a-zip", "text/plain")},
        data={"latitude": "35.0", "longitude": "139.0"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "ZIPファイルを指定してください"


def test_get_upload_returns_expected_keys(monkeypatch, tmp_path):
    upload = Upload(
        id=42,
        camera_id=None,
        file_path="/tmp/sample.jpg",
        file_type="image",
        file_size=123,
        duration_seconds=None,
        recorded_at=None,
        status="completed",
        frame_count=1,
        error_message=None,
        latitude=35.0,
        longitude=139.0,
    )
    upload.uploaded_at = datetime(2025, 1, 1, 0, 0, 0)
    upload.processed_at = datetime(2025, 1, 1, 0, 5, 0)

    client = _build_client(FakeDB(upload=upload, sighting_count=3), monkeypatch, tmp_path)

    response = client.get("/api/v1/uploads/42")

    assert response.status_code == 200
    payload = response.json()

    assert set(payload.keys()) == {
        "id",
        "camera_id",
        "file_path",
        "file_type",
        "file_size",
        "duration_seconds",
        "uploaded_at",
        "recorded_at",
        "processed_at",
        "status",
        "frame_count",
        "error_message",
        "latitude",
        "longitude",
        "sighting_count",
    }
    assert payload["id"] == 42
    assert payload["sighting_count"] == 3


def test_resolve_safe_zip_path_validation(tmp_path):
    base_dir = tmp_path / "frames"
    base_dir.mkdir()

    safe = uploads._resolve_safe_zip_path("frame001.jpg", base_dir)
    assert safe == (base_dir / "frame001.jpg").resolve()

    assert uploads._resolve_safe_zip_path("../escape.jpg", base_dir) is None
    assert uploads._resolve_safe_zip_path("nested/frame.jpg", base_dir) is None
    assert uploads._resolve_safe_zip_path("/absolute/path.jpg", base_dir) is None
