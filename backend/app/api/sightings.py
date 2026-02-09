"""Bear Detection System - Sightings API."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.database import Sighting, Upload
from app.models.schemas import (
    AlertLevel,
    BoundingBox,
    DetectionResponse,
    SightingDetailResponse,
    SightingListResponse,
    SightingResponse,
    SightingStatistics,
)
from app.presenters.sightings import build_sighting_response

router = APIRouter(prefix="/sightings", tags=["sightings"])


@router.get("", response_model=SightingListResponse)
def list_sightings(
    start_date: Optional[datetime] = Query(None, description="開始日時"),
    end_date: Optional[datetime] = Query(None, description="終了日時"),
    alert_level: Optional[AlertLevel] = Query(None, description="警報レベル"),
    min_confidence: Optional[float] = Query(None, ge=0, le=1, description="最小信頼度"),
    camera_id: Optional[int] = Query(None, description="カメラID"),
    bounds: Optional[str] = Query(None, description="地図範囲 (sw_lat,sw_lng,ne_lat,ne_lng)"),
    include_total: bool = Query(True, description="総件数を含めるか"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """熊目撃情報一覧を取得（地図表示用）"""
    query = db.query(Sighting).options(joinedload(Sighting.upload).joinedload(Upload.camera))

    if start_date:
        query = query.filter(Sighting.detected_at >= start_date)
    if end_date:
        query = query.filter(Sighting.detected_at <= end_date)
    if alert_level:
        query = query.filter(Sighting.alert_level == alert_level.value)
    if min_confidence:
        query = query.filter(Sighting.confidence >= min_confidence)
    if camera_id:
        query = query.join(Upload).filter(Upload.camera_id == camera_id)

    if bounds:
        try:
            sw_lat, sw_lng, ne_lat, ne_lng = map(float, bounds.split(","))
            query = query.filter(
                and_(
                    Sighting.latitude >= sw_lat,
                    Sighting.latitude <= ne_lat,
                    Sighting.longitude >= sw_lng,
                    Sighting.longitude <= ne_lng,
                )
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid bounds format. Expected: sw_lat,sw_lng,ne_lat,ne_lng",
            )

    sightings = query.order_by(Sighting.detected_at.desc()).offset(offset).limit(limit).all()
    result = [build_sighting_response(sighting) for sighting in sightings]
    total = query.count() if include_total else len(result)

    return SightingListResponse(total=total, sightings=result)


@router.get("/statistics", response_model=SightingStatistics)
def get_statistics(db: Session = Depends(get_db)):
    """目撃情報の統計を取得"""
    total = db.query(Sighting).count()

    level_counts = db.query(Sighting.alert_level, func.count(Sighting.id)).group_by(Sighting.alert_level).all()
    sightings_by_level = {level: count for level, count in level_counts}

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(Sighting).filter(Sighting.detected_at >= today).count()

    week_ago = datetime.now() - timedelta(days=7)
    week_count = db.query(Sighting).filter(Sighting.detected_at >= week_ago).count()

    avg_conf = db.query(func.avg(Sighting.confidence)).scalar() or 0.0

    return SightingStatistics(
        total_sightings=total,
        sightings_by_level=sightings_by_level,
        sightings_today=today_count,
        sightings_this_week=week_count,
        average_confidence=float(avg_conf),
    )


@router.get("/{sighting_id}", response_model=SightingDetailResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    """目撃情報詳細を取得"""
    sighting = (
        db.query(Sighting)
        .options(joinedload(Sighting.detections), joinedload(Sighting.upload).joinedload(Upload.camera))
        .filter(Sighting.id == sighting_id)
        .first()
    )

    if not sighting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sighting with id {sighting_id} not found",
        )

    detections = [
        DetectionResponse(
            id=det.id,
            class_name=det.class_name,
            confidence=float(det.confidence),
            bbox=BoundingBox(
                x=det.bbox_x,
                y=det.bbox_y,
                width=det.bbox_w,
                height=det.bbox_h,
            ),
        )
        for det in sighting.detections
    ]

    base = build_sighting_response(sighting)
    return SightingDetailResponse(
        id=base.id,
        latitude=base.latitude,
        longitude=base.longitude,
        detected_at=base.detected_at,
        confidence=base.confidence,
        bear_count=base.bear_count,
        alert_level=base.alert_level,
        image_url=base.image_url,
        camera=base.camera,
        created_at=base.created_at,
        detections=detections,
        upload_id=sighting.upload_id,
        frame_number=sighting.frame_number,
    )


@router.get("/recent/", response_model=List[SightingResponse])
def get_recent_sightings(
    hours: int = Query(24, ge=1, le=168, description="過去何時間分"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """最近の目撃情報を取得"""
    since = datetime.now() - timedelta(hours=hours)

    sightings = (
        db.query(Sighting)
        .options(joinedload(Sighting.upload).joinedload(Upload.camera))
        .filter(Sighting.detected_at >= since)
        .order_by(Sighting.detected_at.desc())
        .limit(limit)
        .all()
    )

    return [build_sighting_response(sighting) for sighting in sightings]
