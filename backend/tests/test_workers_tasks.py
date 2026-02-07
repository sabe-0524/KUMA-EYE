from app.workers import tasks


class DummyDB:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def test_process_upload_task_calls_usecase_and_closes_db(monkeypatch):
    db = DummyDB()
    monkeypatch.setattr(tasks, "SessionLocal", lambda: db)
    monkeypatch.setattr(
        tasks,
        "execute_upload_processing",
        lambda **kwargs: {"status": "completed", "upload_id": kwargs["upload_id"]},
    )

    res = tasks.process_upload_task.run(upload_id=9, frame_interval=3, frames_dir="/tmp/f")

    assert res["status"] == "completed"
    assert db.closed is True


def test_test_task_returns_ok():
    assert tasks.test_task.run()["status"] == "ok"
