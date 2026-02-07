from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import images
from app.core.config import settings


def _client(tmp_path, monkeypatch):
    app = FastAPI()
    app.include_router(images.router, prefix=settings.API_V1_PREFIX)
    monkeypatch.setattr(settings, "LOCAL_STORAGE_PATH", str(tmp_path))
    return TestClient(app)


def test_get_image_success(tmp_path, monkeypatch):
    p = tmp_path / "processed" / "1"
    p.mkdir(parents=True)
    f = p / "x.jpg"
    f.write_bytes(b"jpeg")

    client = _client(tmp_path, monkeypatch)
    res = client.get("/api/v1/images/processed/1/x.jpg")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("image/jpeg")


def test_get_image_invalid_path(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    res = client.get("/api/v1/images/../secret.jpg")

    assert res.status_code in {400, 404}


def test_get_image_not_found(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    res = client.get("/api/v1/images/processed/1/nope.jpg")

    assert res.status_code == 404


def test_get_image_unsupported_type(tmp_path, monkeypatch):
    p = tmp_path / "processed" / "1"
    p.mkdir(parents=True)
    f = p / "x.txt"
    f.write_text("txt")

    client = _client(tmp_path, monkeypatch)
    res = client.get("/api/v1/images/processed/1/x.txt")

    assert res.status_code == 400
