"""
Bear Detection System - Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://bearuser:bearpass@localhost:5432/bear_detection_db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_WORKER_CONCURRENCY: int = 2
    CELERY_TASK_ALWAYS_EAGER: bool = True
    
    # Storage
    STORAGE_TYPE: str = "local"  # "local" or "gcs"
    LOCAL_STORAGE_PATH: str = "./storage"
    GCS_BUCKET_NAME: str = ""  # Google Cloud Storage bucket name
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    
    # Firebase
    FIREBASE_PROJECT_ID: str = "kuma-eye"
    
    # Detection Model
    MODEL_PATH: str = "./models/bear_detector.pt"
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.5
    DEFAULT_FRAME_INTERVAL_SECONDS: int = 5
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 500
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png"
    ALLOWED_VIDEO_TYPES: str = "video/mp4,video/quicktime,video/x-msvideo"
    
    # SMTP (Email)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    # Notification
    NOTIFY_RADIUS_METERS: int = 5000
    NOTIFY_STALE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Application
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
