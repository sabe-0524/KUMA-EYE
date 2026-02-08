import json
import subprocess
from datetime import datetime

from PIL import Image

from app.services.video_processor import VideoProcessor


class DummyResult:
    def __init__(self, stdout=""):
        self.stdout = stdout


def test_get_video_info_success(monkeypatch, tmp_path):
    vp = VideoProcessor(frame_interval=5)
    data = {
        "format": {"duration": "10.0"},
        "streams": [{"codec_type": "video", "r_frame_rate": "30/1", "width": 1920, "height": 1080}],
    }
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: DummyResult(stdout=json.dumps(data)))

    info = vp.get_video_info("/tmp/a.mp4")

    assert info["duration"] == 10.0
    assert info["fps"] == 30.0
    assert info["frame_count"] == 300


def test_get_video_info_failure_returns_empty(monkeypatch):
    vp = VideoProcessor(frame_interval=5)
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("x")))

    assert vp.get_video_info("/tmp/a.mp4") == {}


def test_extract_frames_ffmpeg_failure(monkeypatch, tmp_path):
    vp = VideoProcessor(frame_interval=5)
    monkeypatch.setattr(vp, "storage_path", tmp_path)

    def _raise(*args, **kwargs):
        raise subprocess.CalledProcessError(returncode=1, cmd="ffmpeg")

    monkeypatch.setattr(subprocess, "run", _raise)

    out = vp.extract_frames_ffmpeg("/tmp/a.mp4")
    assert out == []


def test_calculate_timestamp_and_save_processed_frame(monkeypatch, tmp_path):
    vp = VideoProcessor(frame_interval=5)
    monkeypatch.setattr(vp, "storage_path", tmp_path)

    base = datetime(2025, 1, 1, 0, 0, 0)
    ts = vp.calculate_timestamp(30, 10.0, start_time=base)
    assert int((ts - base).total_seconds()) == 3

    path = vp.save_processed_frame(Image.new("RGB", (20, 20)), upload_id=1, frame_number=7)
    assert path.endswith("detected_000007.jpg")


def test_list_frame_files_only_images(tmp_path):
    d = tmp_path / "frames"
    d.mkdir()
    (d / "a.jpg").write_bytes(b"a")
    (d / "b.png").write_bytes(b"b")
    (d / "c.txt").write_text("x")

    vp = VideoProcessor(frame_interval=5)
    files = vp.list_frame_files(str(d))

    assert [p.name for p in files] == ["a.jpg", "b.png"]
