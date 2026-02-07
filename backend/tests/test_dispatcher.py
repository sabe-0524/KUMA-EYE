from app.workers import dispatcher


class DummyTask:
    def __init__(self):
        self.apply_calls = []
        self.delay_calls = []

    def apply(self, **kwargs):
        self.apply_calls.append(kwargs)

    def delay(self, **kwargs):
        self.delay_calls.append(kwargs)


def test_enqueue_upload_processing_runs_apply_in_eager_mode(monkeypatch):
    dummy_task = DummyTask()

    monkeypatch.setattr(dispatcher, "process_upload_task", dummy_task)
    monkeypatch.setattr(dispatcher.settings, "CELERY_TASK_ALWAYS_EAGER", True)

    dispatcher.enqueue_upload_processing(upload_id=7, frame_interval=9, frames_dir="/tmp/frames")

    assert len(dummy_task.apply_calls) == 1
    assert dummy_task.apply_calls[0]["kwargs"] == {
        "upload_id": 7,
        "frame_interval": 9,
        "frames_dir": "/tmp/frames",
    }
    assert dummy_task.apply_calls[0]["throw"] is False
    assert dummy_task.delay_calls == []


def test_enqueue_upload_processing_runs_delay_in_async_mode(monkeypatch):
    dummy_task = DummyTask()

    monkeypatch.setattr(dispatcher, "process_upload_task", dummy_task)
    monkeypatch.setattr(dispatcher.settings, "CELERY_TASK_ALWAYS_EAGER", False)

    dispatcher.enqueue_upload_processing(upload_id=8, frame_interval=5)

    assert dummy_task.apply_calls == []
    assert len(dummy_task.delay_calls) == 1
    assert dummy_task.delay_calls[0] == {
        "upload_id": 8,
        "frame_interval": 5,
        "frames_dir": None,
    }
