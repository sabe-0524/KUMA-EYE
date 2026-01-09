"""
Bear Detection System - SQLAlchemy Models
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, 
    DateTime, ForeignKey, Numeric, BigInteger
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.core.database import Base


class Camera(Base):
    """監視カメラ"""
    __tablename__ = "cameras"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    location = Column(Geometry(geometry_type='POINT', srid=4326))
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    
    # Relationships
    uploads = relationship("Upload", back_populates="camera")


class Upload(Base):
    """アップロード映像"""
    __tablename__ = "uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id", ondelete="SET NULL"))
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)  # 'video' or 'image'
    file_size = Column(BigInteger)
    duration_seconds = Column(Integer)
    uploaded_at = Column(DateTime, server_default=func.now())
    recorded_at = Column(DateTime)
    processed_at = Column(DateTime)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    frame_count = Column(Integer)
    error_message = Column(Text)
    # カメラ未登録時の位置情報
    latitude = Column(Numeric(10, 8))
    longitude = Column(Numeric(11, 8))
    
    # Relationships
    camera = relationship("Camera", back_populates="uploads")
    sightings = relationship("Sighting", back_populates="upload", cascade="all, delete-orphan")
    jobs = relationship("Job", back_populates="upload", cascade="all, delete-orphan")


class Sighting(Base):
    """熊目撃記録"""
    __tablename__ = "sightings"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="CASCADE"))
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    latitude = Column(Numeric(10, 8), nullable=False)
    longitude = Column(Numeric(11, 8), nullable=False)
    detected_at = Column(DateTime, nullable=False)
    confidence = Column(Numeric(5, 4), nullable=False)
    bear_count = Column(Integer, default=1)
    alert_level = Column(String(20), nullable=False)  # critical, warning, caution, low
    image_path = Column(String(500))
    frame_number = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    upload = relationship("Upload", back_populates="sightings")
    detections = relationship("Detection", back_populates="sighting", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="sighting", cascade="all, delete-orphan")


class Detection(Base):
    """検出詳細"""
    __tablename__ = "detections"
    
    id = Column(Integer, primary_key=True, index=True)
    sighting_id = Column(Integer, ForeignKey("sightings.id", ondelete="CASCADE"))
    class_name = Column(String(50), nullable=False)
    confidence = Column(Numeric(5, 4), nullable=False)
    bbox_x = Column(Integer, nullable=False)
    bbox_y = Column(Integer, nullable=False)
    bbox_w = Column(Integer, nullable=False)
    bbox_h = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    sighting = relationship("Sighting", back_populates="detections")


class Alert(Base):
    """警報"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    sighting_id = Column(Integer, ForeignKey("sightings.id", ondelete="CASCADE"))
    alert_level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    notified_at = Column(DateTime, server_default=func.now())
    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime)
    acknowledged_by = Column(String(100))
    
    # Relationships
    sighting = relationship("Sighting", back_populates="alerts")


class Job(Base):
    """バックグラウンドジョブ"""
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_id = Column(Integer, ForeignKey("uploads.id", ondelete="CASCADE"))
    job_type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    progress = Column(Integer, default=0)
    result = Column(Text)  # JSON string
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    upload = relationship("Upload", back_populates="jobs")
