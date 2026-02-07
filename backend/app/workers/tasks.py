"""Celery task definitions for upload processing."""

from __future__ import annotations

from app.core.database import SessionLocal
from app.usecases.upload_processing import execute_upload_processing
from app.workers.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3)
def process_upload_task(
    self,
    upload_id: int,
    frame_interval: int = 5,
    frames_dir: str | None = None,
) -> dict:
    """Run upload processing via use case."""
    db = SessionLocal()
    try:
        return execute_upload_processing(
            db=db,
            upload_id=upload_id,
            frame_interval=frame_interval,
            frames_dir=frames_dir,
        )
    finally:
        db.close()


@celery_app.task
def test_task() -> dict:
    """Health check task for Celery workers."""
    return {"status": "ok", "message": "Celery is working!"}
