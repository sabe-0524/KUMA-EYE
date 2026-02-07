"""Task dispatcher for upload processing."""

from __future__ import annotations

from app.core.config import settings
from app.workers.tasks import process_upload_task


def enqueue_upload_processing(
    upload_id: int,
    frame_interval: int,
    frames_dir: str | None = None,
) -> None:
    """Enqueue upload processing task.

    In local mode, eager execution keeps a single code path without requiring
    a dedicated worker process.
    """
    kwargs = {
        "upload_id": upload_id,
        "frame_interval": frame_interval,
        "frames_dir": frames_dir,
    }

    if settings.CELERY_TASK_ALWAYS_EAGER:
        process_upload_task.apply(kwargs=kwargs, throw=False)
        return

    process_upload_task.delay(**kwargs)
