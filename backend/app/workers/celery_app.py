"""Shared Celery application configuration."""

from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "bear_detection",
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Tokyo",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
