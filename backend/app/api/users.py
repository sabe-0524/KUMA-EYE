"""
Bear Detection System - Users API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user, FirebaseUser
from app.models.schemas import (
    UserNotificationSettingsResponse,
    UserNotificationSettingsUpdate,
    LocationUpdateRequest,
)
from app.services.notification_service import (
    get_or_create_user,
    update_notification_settings,
    update_location,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserNotificationSettingsResponse)
def get_me(
    current_user: FirebaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    自分の通知設定を取得（未登録なら作成）
    """
    user = get_or_create_user(db, current_user)
    return UserNotificationSettingsResponse(
        email=user.email,
        display_name=user.display_name,
        email_opt_in=user.email_opt_in,
        latitude=float(user.latitude) if user.latitude is not None else None,
        longitude=float(user.longitude) if user.longitude is not None else None,
        location_updated_at=user.location_updated_at,
    )


@router.put("/me/notification-settings", response_model=UserNotificationSettingsResponse)
def update_me_notification_settings(
    payload: UserNotificationSettingsUpdate,
    current_user: FirebaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    自分の通知設定を更新
    """
    user = get_or_create_user(db, current_user)
    user = update_notification_settings(db, user, payload.email_opt_in)
    return UserNotificationSettingsResponse(
        email=user.email,
        display_name=user.display_name,
        email_opt_in=user.email_opt_in,
        latitude=float(user.latitude) if user.latitude is not None else None,
        longitude=float(user.longitude) if user.longitude is not None else None,
        location_updated_at=user.location_updated_at,
    )


@router.post("/me/location", response_model=UserNotificationSettingsResponse)
def update_me_location(
    payload: LocationUpdateRequest,
    current_user: FirebaseUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    現在地を更新
    """
    user = get_or_create_user(db, current_user)
    user = update_location(db, user, payload.latitude, payload.longitude)
    return UserNotificationSettingsResponse(
        email=user.email,
        display_name=user.display_name,
        email_opt_in=user.email_opt_in,
        latitude=float(user.latitude) if user.latitude is not None else None,
        longitude=float(user.longitude) if user.longitude is not None else None,
        location_updated_at=user.location_updated_at,
    )
