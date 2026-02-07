"""Compatibility Celery worker entrypoint.

This module keeps backward compatibility for:
    celery -A app.celery_worker worker
"""

from __future__ import annotations

from app.workers.celery_app import celery_app
from app.workers.tasks import process_upload_task, test_task as shared_test_task


@celery_app.task(bind=True, max_retries=3)
def process_upload(
    self,
    upload_id: int,
    latitude: float | None = None,
    longitude: float | None = None,
    frame_interval: int = 5,
    frames_dir: str | None = None,
) -> dict:
    """Backward-compatible task wrapper.

    latitude/longitude are kept for old callers but ignored because the
    canonical processing logic now resolves location from DB data.
    """
    _ = (self, latitude, longitude)
    return process_upload_task.run(
        upload_id=upload_id,
        frame_interval=frame_interval,
        frames_dir=frames_dir,
    )


@celery_app.task
def test_task() -> dict:
    """Backward-compatible test task name."""
    return shared_test_task.run()
