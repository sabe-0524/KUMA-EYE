"""
Bear Detection System - Alerts API
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user, FirebaseUser
from app.models.database import Alert, Sighting, Upload, Camera
from app.models.schemas import (
    AlertResponse,
    AlertListResponse,
    AlertAcknowledge,
    AlertLevel,
    SightingResponse,
    CameraSummary
)
from app.core.config import settings

router = APIRouter(prefix="/alerts", tags=["alerts"])


def get_image_url(image_path: Optional[str]) -> Optional[str]:
    """画像パスからURLを生成"""
    if not image_path:
        return None
    storage_path = settings.LOCAL_STORAGE_PATH
    if image_path.startswith(storage_path):
        relative_path = image_path[len(storage_path):].lstrip("/")
    else:
        relative_path = image_path
    return f"/api/v1/images/{relative_path}"


@router.get("", response_model=AlertListResponse)
def list_alerts(
    acknowledged: Optional[bool] = Query(None, description="確認済みフィルタ"),
    alert_level: Optional[AlertLevel] = Query(None, description="警報レベル"),
    start_date: Optional[datetime] = Query(None, description="開始日時"),
    end_date: Optional[datetime] = Query(None, description="終了日時"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    警報一覧を取得
    """
    query = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    )
    
    # フィルタ適用
    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == acknowledged)
    if alert_level:
        query = query.filter(Alert.alert_level == alert_level.value)
    if start_date:
        query = query.filter(Alert.notified_at >= start_date)
    if end_date:
        query = query.filter(Alert.notified_at <= end_date)
    
    # 総数取得
    total = query.count()
    
    # ソートとページネーション（未確認を優先、新しい順）
    alerts = query.order_by(
        Alert.acknowledged.asc(),
        Alert.notified_at.desc()
    ).offset(offset).limit(limit).all()
    
    # レスポンス構築
    result = []
    for alert in alerts:
        sighting_response = None
        if alert.sighting:
            sighting = alert.sighting
            camera_summary = None
            if sighting.upload and sighting.upload.camera:
                camera_summary = CameraSummary(
                    id=sighting.upload.camera.id,
                    name=sighting.upload.camera.name
                )
            
            sighting_response = SightingResponse(
                id=sighting.id,
                latitude=float(sighting.latitude),
                longitude=float(sighting.longitude),
                detected_at=sighting.detected_at,
                confidence=float(sighting.confidence),
                bear_count=sighting.bear_count,
                alert_level=sighting.alert_level,
                image_url=get_image_url(sighting.image_path),
                camera=camera_summary,
                created_at=sighting.created_at
            )
        
        result.append(AlertResponse(
            id=alert.id,
            sighting_id=alert.sighting_id,
            alert_level=alert.alert_level,
            message=alert.message,
            notified_at=alert.notified_at,
            acknowledged=alert.acknowledged,
            acknowledged_at=alert.acknowledged_at,
            acknowledged_by=alert.acknowledged_by,
            sighting=sighting_response
        ))
    
    return AlertListResponse(total=total, alerts=result)


@router.get("/unacknowledged", response_model=AlertListResponse)
def get_unacknowledged_alerts(
    limit: int = Query(50, ge=1, le=200),
    start_date: Optional[datetime] = Query(None, description="開始日時"),
    end_date: Optional[datetime] = Query(None, description="終了日時"),
    db: Session = Depends(get_db)
):
    """
    未確認の警報一覧を取得
    """
    query = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    ).filter(Alert.acknowledged == False)

    if start_date:
        query = query.filter(Alert.notified_at >= start_date)
    if end_date:
        query = query.filter(Alert.notified_at <= end_date)
    
    total = query.count()
    
    alerts = query.order_by(
        # critical > warning > caution > low の順
        Alert.alert_level.desc(),
        Alert.notified_at.desc()
    ).limit(limit).all()
    
    result = []
    for alert in alerts:
        sighting_response = None
        if alert.sighting:
            sighting = alert.sighting
            camera_summary = None
            if sighting.upload and sighting.upload.camera:
                camera_summary = CameraSummary(
                    id=sighting.upload.camera.id,
                    name=sighting.upload.camera.name
                )
            
            sighting_response = SightingResponse(
                id=sighting.id,
                latitude=float(sighting.latitude),
                longitude=float(sighting.longitude),
                detected_at=sighting.detected_at,
                confidence=float(sighting.confidence),
                bear_count=sighting.bear_count,
                alert_level=sighting.alert_level,
                image_url=get_image_url(sighting.image_path),
                camera=camera_summary,
                created_at=sighting.created_at
            )
        
        result.append(AlertResponse(
            id=alert.id,
            sighting_id=alert.sighting_id,
            alert_level=alert.alert_level,
            message=alert.message,
            notified_at=alert.notified_at,
            acknowledged=alert.acknowledged,
            acknowledged_at=alert.acknowledged_at,
            acknowledged_by=alert.acknowledged_by,
            sighting=sighting_response
        ))
    
    return AlertListResponse(total=total, alerts=result)


@router.get("/count")
def get_alert_count(
    start_date: Optional[datetime] = Query(None, description="開始日時"),
    end_date: Optional[datetime] = Query(None, description="終了日時"),
    db: Session = Depends(get_db)
):
    """
    警報数を取得（バッジ表示用）
    """
    base_query = db.query(Alert).filter(Alert.acknowledged == False)
    if start_date:
        base_query = base_query.filter(Alert.notified_at >= start_date)
    if end_date:
        base_query = base_query.filter(Alert.notified_at <= end_date)

    unacknowledged = base_query.count()
    critical = base_query.filter(Alert.alert_level == "critical").count()
    
    return {
        "unacknowledged": unacknowledged,
        "critical": critical
    }


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    警報詳細を取得
    """
    alert = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    ).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found"
        )
    
    sighting_response = None
    if alert.sighting:
        sighting = alert.sighting
        camera_summary = None
        if sighting.upload and sighting.upload.camera:
            camera_summary = CameraSummary(
                id=sighting.upload.camera.id,
                name=sighting.upload.camera.name
            )
        
        sighting_response = SightingResponse(
            id=sighting.id,
            latitude=float(sighting.latitude),
            longitude=float(sighting.longitude),
            detected_at=sighting.detected_at,
            confidence=float(sighting.confidence),
            bear_count=sighting.bear_count,
            alert_level=sighting.alert_level,
            image_url=get_image_url(sighting.image_path),
            camera=camera_summary,
            created_at=sighting.created_at
        )
    
    return AlertResponse(
        id=alert.id,
        sighting_id=alert.sighting_id,
        alert_level=alert.alert_level,
        message=alert.message,
        notified_at=alert.notified_at,
        acknowledged=alert.acknowledged,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by=alert.acknowledged_by,
        sighting=sighting_response
    )


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    data: AlertAcknowledge = None,
    db: Session = Depends(get_db)
):
    """
    警報を確認済みにする
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found"
        )
    
    alert.acknowledged = True
    alert.acknowledged_at = datetime.now()
    if data and data.acknowledged_by:
        alert.acknowledged_by = data.acknowledged_by
    
    db.commit()
    db.refresh(alert)
    
    # 詳細を再取得
    return get_alert(alert_id, db)


@router.put("/acknowledge-all")
def acknowledge_all_alerts(
    data: AlertAcknowledge = None,
    db: Session = Depends(get_db)
):
    """
    全ての未確認警報を確認済みにする
    """
    now = datetime.now()
    acknowledged_by = data.acknowledged_by if data else None
    
    count = db.query(Alert).filter(
        Alert.acknowledged == False
    ).update({
        "acknowledged": True,
        "acknowledged_at": now,
        "acknowledged_by": acknowledged_by
    })
    
    db.commit()
    
    return {"acknowledged_count": count}
