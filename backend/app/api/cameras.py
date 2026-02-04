"""
Bear Detection System - Cameras API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user, FirebaseUser
from app.models.database import Camera
from app.models.schemas import (
    CameraCreate, 
    CameraUpdate, 
    CameraResponse, 
    CameraListResponse
)

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
def create_camera(
    camera: CameraCreate, 
    db: Session = Depends(get_db),
    # NOTE: 一時的に認証を無効化（実装は残す）
    # current_user: FirebaseUser = Depends(get_current_user)
):
    """
    カメラを登録（要認証）
    """
    # PostGIS Point作成
    location = func.ST_SetSRID(
        func.ST_MakePoint(camera.longitude, camera.latitude), 
        4326
    )
    
    db_camera = Camera(
        name=camera.name,
        latitude=camera.latitude,
        longitude=camera.longitude,
        location=location,
        description=camera.description,
        is_active=camera.is_active
    )
    
    db.add(db_camera)
    db.commit()
    db.refresh(db_camera)
    
    return db_camera


@router.get("", response_model=CameraListResponse)
def list_cameras(
    is_active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: Optional[FirebaseUser] = Depends(get_optional_user)
):
    """
    カメラ一覧を取得（認証オプション）
    """
    query = db.query(Camera)
    
    if is_active is not None:
        query = query.filter(Camera.is_active == is_active)
    
    total = query.count()
    cameras = query.order_by(Camera.created_at.desc()).offset(offset).limit(limit).all()
    
    return CameraListResponse(total=total, cameras=cameras)


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: int, db: Session = Depends(get_db)):
    """
    カメラ詳細を取得
    """
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    
    return camera


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(
    camera_id: int, 
    camera_update: CameraUpdate, 
    db: Session = Depends(get_db)
):
    """
    カメラ情報を更新
    """
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    
    # 更新するフィールドのみ適用
    update_data = camera_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(camera, field, value)
    
    # 緯度経度が更新された場合、locationも更新
    if "latitude" in update_data or "longitude" in update_data:
        lat = update_data.get("latitude", camera.latitude)
        lng = update_data.get("longitude", camera.longitude)
        camera.location = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
    
    db.commit()
    db.refresh(camera)
    
    return camera


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_camera(camera_id: int, db: Session = Depends(get_db)):
    """
    カメラを削除
    """
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    
    db.delete(camera)
    db.commit()
    
    return None
