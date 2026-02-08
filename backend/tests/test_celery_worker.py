from app import celery_worker


def test_process_upload_wrapper_delegates(monkeypatch):
    called = {}

    def _run(**kwargs):
        called.update(kwargs)
        return {"status": "ok"}

    monkeypatch.setattr(celery_worker.process_upload_task, "run", _run)

    out = celery_worker.process_upload.run(upload_id=1, latitude=1.0, longitude=2.0, frame_interval=4, frames_dir="/tmp/frames")

    assert out["status"] == "ok"
    assert called["upload_id"] == 1
    assert called["frame_interval"] == 4
    assert called["frames_dir"] == "/tmp/frames"


def test_test_task_wrapper():
    out = celery_worker.test_task.run()
    assert out["status"] == "ok"
