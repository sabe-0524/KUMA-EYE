from types import SimpleNamespace

from PIL import Image

from app.usecases import stream_processing
from app.usecases.stream_processing import process_stream_frame


class FakeQuery:
    def __init__(self, first_value=None):
        self._first_value = first_value

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._first_value


class FakeDB:
    def __init__(self, upload=None, camera=None):
        self.upload = upload
        self.camera = camera
        self.commits = 0

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "Upload":
            return FakeQuery(self.upload)
        if name == "Camera":
            return FakeQuery(self.camera)
        return FakeQuery(None)

    def commit(self):
        self.commits += 1


def test_process_stream_frame_returns_empty_when_no_detections(monkeypatch):
    upload = SimpleNamespace(
        id=10,
        camera_id=None,
        latitude=35.0,
        longitude=139.0,
        status="pending",
        frame_count=None,
        processed_at=None,
    )
    session = SimpleNamespace(upload_id=10, frame_interval=5)
    db = FakeDB(upload=upload)

    monkeypatch.setattr(
        stream_processing,
        "get_detection_service",
        lambda: SimpleNamespace(detect=lambda _: []),
    )
    monkeypatch.setattr(stream_processing, "get_video_processor", lambda *_: SimpleNamespace())

    result = process_stream_frame(
        db,
        session=session,
        frame_number=0,
        frame_image=Image.new("RGB", (10, 10)),
    )

    assert result["detections_count"] == 0
    assert upload.status == "processing"
    assert upload.frame_count == 1
    assert db.commits == 1


def test_process_stream_frame_persists_detections(monkeypatch):
    upload = SimpleNamespace(
        id=11,
        camera_id=None,
        latitude=35.0,
        longitude=139.0,
        status="pending",
        frame_count=2,
        processed_at=None,
    )
    session = SimpleNamespace(upload_id=11, frame_interval=5, notification_dispatched=False, session_id="session-1")
    db = FakeDB(upload=upload)
    notify_spy = {"called": 0}

    monkeypatch.setattr(
        stream_processing,
        "get_detection_service",
        lambda: SimpleNamespace(detect=lambda _: [{"confidence": 0.9, "class_name": "bear", "bbox": {"x": 0, "y": 0, "width": 1, "height": 1}}]),
    )
    monkeypatch.setattr(stream_processing, "get_video_processor", lambda *_: SimpleNamespace())
    monkeypatch.setattr(
        stream_processing,
        "save_detection_result",
        lambda **kwargs: (101, 201, "warning"),
    )
    monkeypatch.setattr(
        stream_processing,
        "notify_for_alert",
        lambda *_args, **_kwargs: notify_spy.__setitem__("called", notify_spy["called"] + 1),
    )

    result = process_stream_frame(
        db,
        session=session,
        frame_number=3,
        frame_image=Image.new("RGB", (10, 10)),
    )

    assert result == {
        "detections_count": 1,
        "sighting_id": 101,
        "alert_id": 201,
        "alert_level": "warning",
    }
    assert notify_spy["called"] == 1
    assert session.notification_dispatched is True
    assert upload.frame_count == 3
    assert db.commits == 1


def test_process_stream_frame_raises_when_upload_missing():
    session = SimpleNamespace(upload_id=999, frame_interval=5)
    db = FakeDB(upload=None)

    try:
        process_stream_frame(
            db,
            session=session,
            frame_number=0,
            frame_image=Image.new("RGB", (10, 10)),
        )
    except ValueError as exc:
        assert "Upload with id 999 not found" in str(exc)
    else:
        raise AssertionError("ValueError expected")
