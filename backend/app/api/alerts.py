"""Bear Detection System - Alerts API."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.database import Alert, Sighting, Upload
from app.models.schemas import AlertAcknowledge, AlertLevel, AlertListResponse, AlertResponse
from app.presenters.sightings import build_sighting_response

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _build_alert_response(alert: Alert) -> AlertResponse:
    sighting_response = build_sighting_response(alert.sighting) if alert.sighting else None

    return AlertResponse(
        id=alert.id,
        sighting_id=alert.sighting_id,
        alert_level=alert.alert_level,
        message=alert.message,
        notified_at=alert.notified_at,
        acknowledged=alert.acknowledged,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by=alert.acknowledged_by,
        sighting=sighting_response,
    )


@router.get("", response_model=AlertListResponse)
def list_alerts(
    acknowledged: Optional[bool] = Query(None, description="確認済みフィルタ"),
    alert_level: Optional[AlertLevel] = Query(None, description="警報レベル"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """警報一覧を取得"""
    query = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    )

    if acknowledged is not None:
        query = query.filter(Alert.acknowledged == acknowledged)
    if alert_level:
        query = query.filter(Alert.alert_level == alert_level.value)

    total = query.count()
    alerts = (
        query.order_by(Alert.acknowledged.asc(), Alert.notified_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = [_build_alert_response(alert) for alert in alerts]
    return AlertListResponse(total=total, alerts=result)


@router.get("/unacknowledged", response_model=AlertListResponse)
def get_unacknowledged_alerts(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """未確認の警報一覧を取得"""
    query = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    ).filter(Alert.acknowledged == False)

    total = query.count()
    alerts = query.order_by(Alert.alert_level.desc(), Alert.notified_at.desc()).limit(limit).all()

    result = [_build_alert_response(alert) for alert in alerts]
    return AlertListResponse(total=total, alerts=result)


@router.get("/count")
def get_alert_count(db: Session = Depends(get_db)):
    """警報数を取得（バッジ表示用）"""
    unacknowledged = db.query(Alert).filter(Alert.acknowledged == False).count()
    critical = db.query(Alert).filter(
        Alert.acknowledged == False,
        Alert.alert_level == "critical",
    ).count()

    return {
        "unacknowledged": unacknowledged,
        "critical": critical,
    }


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """警報詳細を取得"""
    alert = db.query(Alert).options(
        joinedload(Alert.sighting).joinedload(Sighting.upload).joinedload(Upload.camera)
    ).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found",
        )

    return _build_alert_response(alert)


@router.put("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    data: AlertAcknowledge = None,
    db: Session = Depends(get_db),
):
    """警報を確認済みにする"""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found",
        )

    alert.acknowledged = True
    alert.acknowledged_at = datetime.now()
    if data and data.acknowledged_by:
        alert.acknowledged_by = data.acknowledged_by

    db.commit()
    db.refresh(alert)

    return get_alert(alert_id, db)


@router.put("/acknowledge-all")
def acknowledge_all_alerts(
    data: AlertAcknowledge = None,
    db: Session = Depends(get_db),
):
    """全ての未確認警報を確認済みにする"""
    now = datetime.now()
    acknowledged_by = data.acknowledged_by if data else None

    count = db.query(Alert).filter(Alert.acknowledged == False).update(
        {
            "acknowledged": True,
            "acknowledged_at": now,
            "acknowledged_by": acknowledged_by,
        }
    )

    db.commit()
    return {"acknowledged_count": count}
