from app.services import storage


def test_local_storage_save_url_exists_delete(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "STORAGE_TYPE", "local")
    monkeypatch.setattr(storage.settings, "LOCAL_STORAGE_PATH", str(tmp_path))

    service = storage.StorageService()
    saved = service.save_file(b"abc", "uploads/a.jpg")

    assert saved.endswith("uploads/a.jpg")
    assert service.file_exists("uploads/a.jpg") is True
    assert service.get_file_url(saved).startswith("/api/v1/images/")
    assert service.delete_file("uploads/a.jpg") is True


def test_storage_fallback_to_local_when_gcs_init_fails(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "STORAGE_TYPE", "gcs")
    monkeypatch.setattr(storage.settings, "LOCAL_STORAGE_PATH", str(tmp_path))

    class BrokenClient:
        def __init__(self):
            raise RuntimeError("boom")

    monkeypatch.setattr(storage.storage, "Client", BrokenClient)

    service = storage.StorageService()
    assert service.storage_type == "local"


def test_get_storage_service_singleton(monkeypatch, tmp_path):
    monkeypatch.setattr(storage.settings, "STORAGE_TYPE", "local")
    monkeypatch.setattr(storage.settings, "LOCAL_STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(storage, "_storage_service", None)

    a = storage.get_storage_service()
    b = storage.get_storage_service()

    assert a is b
