"""
Bear Detection System - Pydantic Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class AlertLevel(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    CAUTION = "caution"
    LOW = "low"


class UploadStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class FileType(str, Enum):
    VIDEO = "video"
    IMAGE = "image"


# =============================================================================
# Camera Schemas
# =============================================================================

class CameraBase(BaseModel):
    name: str = Field(..., max_length=255, description="カメラ名")
    latitude: float = Field(..., ge=-90, le=90, description="緯度")
    longitude: float = Field(..., ge=-180, le=180, description="経度")
    description: Optional[str] = Field(None, description="説明")
    is_active: bool = Field(True, description="稼働状態")


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CameraResponse(CameraBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CameraListResponse(BaseModel):
    total: int
    cameras: List[CameraResponse]


# =============================================================================
# Upload Schemas
# =============================================================================

class UploadCreate(BaseModel):
    camera_id: Optional[int] = Field(None, description="登録済みカメラID")
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="緯度（カメラ未指定時）")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="経度（カメラ未指定時）")
    recorded_at: Optional[datetime] = Field(None, description="撮影日時")
    frame_interval: int = Field(5, ge=1, le=60, description="フレーム抽出間隔（秒）")


class UploadResponse(BaseModel):
    upload_id: int
    status: UploadStatus
    message: str
    estimated_time_seconds: Optional[int] = None
    
    class Config:
        from_attributes = True


class UploadDetailResponse(BaseModel):
    id: int
    camera_id: Optional[int]
    file_path: str
    file_type: FileType
    file_size: Optional[int]
    duration_seconds: Optional[int]
    uploaded_at: datetime
    recorded_at: Optional[datetime]
    processed_at: Optional[datetime]
    status: UploadStatus
    frame_count: Optional[int]
    error_message: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    sighting_count: int = 0
    
    class Config:
        from_attributes = True


# =============================================================================
# Detection Schemas
# =============================================================================

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class DetectionBase(BaseModel):
    class_name: str
    confidence: float = Field(..., ge=0, le=1)
    bbox: BoundingBox


class DetectionResponse(DetectionBase):
    id: int
    
    class Config:
        from_attributes = True


# =============================================================================
# Sighting Schemas
# =============================================================================

class SightingBase(BaseModel):
    latitude: float
    longitude: float
    detected_at: datetime
    confidence: float = Field(..., ge=0, le=1)
    bear_count: int = Field(1, ge=1)
    alert_level: AlertLevel


class SightingCreate(SightingBase):
    upload_id: int
    image_path: Optional[str] = None
    frame_number: Optional[int] = None


class CameraSummary(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class SightingResponse(SightingBase):
    id: int
    image_url: Optional[str] = None
    camera: Optional[CameraSummary] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class SightingDetailResponse(SightingResponse):
    detections: List[DetectionResponse] = []
    upload_id: int
    frame_number: Optional[int] = None
    
    class Config:
        from_attributes = True


class SightingListResponse(BaseModel):
    total: int
    sightings: List[SightingResponse]


# =============================================================================
# Alert Schemas
# =============================================================================

class AlertBase(BaseModel):
    alert_level: AlertLevel
    message: str


class AlertResponse(AlertBase):
    id: int
    sighting_id: int
    notified_at: datetime
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    sighting: Optional[SightingResponse] = None
    
    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    total: int
    alerts: List[AlertResponse]


class AlertAcknowledge(BaseModel):
    acknowledged_by: Optional[str] = Field(None, max_length=100)


# =============================================================================
# User Notification Schemas
# =============================================================================

class UserNotificationSettingsResponse(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    email_opt_in: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserNotificationSettingsUpdate(BaseModel):
    email_opt_in: bool


class LocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


# =============================================================================
# Query Parameters
# =============================================================================

class SightingQueryParams(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    alert_level: Optional[AlertLevel] = None
    min_confidence: Optional[float] = Field(None, ge=0, le=1)
    camera_id: Optional[int] = None
    bounds: Optional[str] = Field(None, description="sw_lat,sw_lng,ne_lat,ne_lng")
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


class AlertQueryParams(BaseModel):
    acknowledged: Optional[bool] = None
    alert_level: Optional[AlertLevel] = None
    limit: int = Field(100, ge=1, le=1000)
    offset: int = Field(0, ge=0)


# =============================================================================
# Statistics
# =============================================================================

class SightingStatistics(BaseModel):
    total_sightings: int
    sightings_by_level: dict
    sightings_today: int
    sightings_this_week: int
    average_confidence: float


# =============================================================================
# Health Check
# =============================================================================

class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
