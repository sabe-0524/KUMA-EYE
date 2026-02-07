from datetime import datetime
from types import SimpleNamespace

from PIL import Image

from app.usecases import upload_processing
from app.usecases.upload_processing import execute_upload_processing

class EmptyQuery:
    def __init__(self, first_value=None):
        self._first_value = first_value

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._first_value


class EmptyDB:
    def __init__(self):
        self.upload = None
        self.camera = None
        self.added = []
        self.commits = 0
        self.rollbacks = 0
        self.flushed = 0

    def query(self, model):
        name = getattr(model, "__name__", str(model))
        if name == "Upload":
            return EmptyQuery(self.upload)
        if name == "Camera":
            return EmptyQuery(self.camera)
        return EmptyQuery(None)

    def add(self, obj):
        self.added.append(obj)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def flush(self):
        self.flushed += 1



def test_execute_upload_processing_returns_failed_when_upload_not_found():
    result = execute_upload_processing(db=EmptyDB(), upload_id=999, frame_interval=5)

    assert result["status"] == "failed"
    assert result["upload_id"] == 999
    assert result["error"] == "Upload not found"


def test_resolve_location_with_camera():
    db = EmptyDB()
    db.camera = SimpleNamespace(id=2, latitude=35.2, longitude=139.2, name="Cam-A")
    upload = SimpleNamespace(camera_id=2, latitude=None, longitude=None)

    lat, lng, name = upload_processing._resolve_location(db, upload)

    assert lat == 35.2
    assert lng == 139.2
    assert name == "Cam-A"


def test_resolve_location_without_camera():
    db = EmptyDB()
    upload = SimpleNamespace(camera_id=None, latitude=35.0, longitude=139.0)

    lat, lng, name = upload_processing._resolve_location(db, upload)

    assert lat == 35.0
    assert lng == 139.0
    assert name is None


def test_iter_single_image(tmp_path):
    img_path = tmp_path / "img.jpg"
    Image.new("RGB", (10, 10)).save(img_path)

    frames = list(upload_processing._iter_single_image(str(img_path)))

    assert frames[0][0] == 0
    assert frames[0][1].size == (10, 10)


def test_iter_directory_frames_skips_unreadable(monkeypatch, tmp_path):
    frame_dir = tmp_path / "frames"
    frame_dir.mkdir()
    ok = frame_dir / "ok.jpg"
    bad = frame_dir / "bad.jpg"
    Image.new("RGB", (8, 8)).save(ok)
    bad.write_bytes(b"not-an-image")

    video_processor = SimpleNamespace(list_frame_files=lambda _: [ok, bad])
    out = list(upload_processing._iter_directory_frames(video_processor, str(frame_dir)))

    assert len(out) == 1
    assert out[0][0] == 0


def test_build_frame_iterator_branches():
    vp = SimpleNamespace()
    upload_video = SimpleNamespace(file_type="video", file_path="/tmp/a.mp4")
    upload_image = SimpleNamespace(file_type="image", file_path="/tmp/a.jpg")

    assert upload_processing._build_frame_iterator(upload_video, "/tmp/frames", vp)
    assert upload_processing._build_frame_iterator(upload_video, None, vp)
    assert upload_processing._build_frame_iterator(upload_image, None, vp)


def test_save_detection_result_persists_entities():
    class DB(EmptyDB):
        def __init__(self):
            super().__init__()
            self.next_id = 1

        def add(self, obj):
            if getattr(obj, "id", None) is None:
                obj.id = self.next_id
                self.next_id += 1
            super().add(obj)

    db = DB()
    upload = SimpleNamespace(id=10)
    detection_service = SimpleNamespace(
        calculate_alert_level=lambda _: "warning",
        draw_detections=lambda image, detections: image,
        create_alert_message=lambda *args, **kwargs: "alert-message",
    )
    video_processor = SimpleNamespace(save_processed_frame=lambda *args, **kwargs: "/tmp/detected.jpg")
    frame_image = Image.new("RGB", (10, 10))
    detections = [{"class_name": "bear", "confidence": 0.9, "bbox": {"x": 1, "y": 2, "width": 3, "height": 4}}]

    sighting_id, alert_id, level = upload_processing._save_detection_result(
        db=db,
        upload=upload,
        frame_number=1,
        frame_image=frame_image,
        detections=detections,
        latitude=35.0,
        longitude=139.0,
        camera_name="Cam-A",
        detection_service=detection_service,
        video_processor=video_processor,
    )

    assert level == "warning"
    assert sighting_id is not None
    assert alert_id is not None
    assert len(db.added) >= 3


def test_mark_upload_failed_updates_status():
    db = EmptyDB()
    upload = SimpleNamespace(id=1, status="processing", error_message=None, processed_at=None)
    db.upload = upload

    upload_processing._mark_upload_failed(db, 1, "x" * 3000)

    assert upload.status == "failed"
    assert len(upload.error_message) == 2000
    assert isinstance(upload.processed_at, datetime)


def test_execute_upload_processing_success(monkeypatch):
    db = EmptyDB()
    upload = SimpleNamespace(
        id=5,
        status="pending",
        error_message=None,
        file_type="image",
        file_path="/tmp/a.jpg",
        camera_id=None,
        latitude=35.0,
        longitude=139.0,
        duration_seconds=None,
        frame_count=None,
        processed_at=None,
    )
    db.upload = upload
    monkeypatch.setattr(upload_processing, "get_detection_service", lambda: SimpleNamespace(detect=lambda _: [{"confidence": 0.9}]))
    monkeypatch.setattr(
        upload_processing,
        "get_video_processor",
        lambda *_: SimpleNamespace(get_video_info=lambda *_: {"duration": 10}),
    )
    monkeypatch.setattr(
        upload_processing,
        "_build_frame_iterator",
        lambda **kwargs: iter([(0, Image.new("RGB", (5, 5)))]),
    )
    monkeypatch.setattr(upload_processing, "_save_detection_result", lambda **kwargs: (1, 2, "warning"))
    monkeypatch.setattr(upload_processing, "notify_for_alert", lambda *_: {"sent": 1})

    result = execute_upload_processing(db=db, upload_id=5, frame_interval=5)

    assert result["status"] == "completed"
    assert result["sightings_count"] == 1
    assert upload.status == "completed"


def test_execute_upload_processing_failure_calls_mark_failed(monkeypatch):
    db = EmptyDB()
    upload = SimpleNamespace(
        id=6,
        status="pending",
        error_message=None,
        file_type="image",
        file_path="/tmp/a.jpg",
        camera_id=None,
        latitude=35.0,
        longitude=139.0,
        duration_seconds=None,
        frame_count=None,
        processed_at=None,
    )
    db.upload = upload

    monkeypatch.setattr(upload_processing, "get_detection_service", lambda: SimpleNamespace(detect=lambda _: []))
    monkeypatch.setattr(upload_processing, "get_video_processor", lambda *_: SimpleNamespace())
    monkeypatch.setattr(
        upload_processing,
        "_build_frame_iterator",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    result = execute_upload_processing(db=db, upload_id=6, frame_interval=5)

    assert result["status"] == "failed"
    assert upload.status == "failed"
