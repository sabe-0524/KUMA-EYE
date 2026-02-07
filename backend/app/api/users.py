"""
Bear Detection System - Users API
"""
from datetime import datetime
from typing import Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import FirebaseUser, get_current_user
from app.core.database import get_db
from app.models.database import User
from app.models.schemas import (
    UserLocationUpdate,
    UserNotificationSettingsUpdate,
    UserResponse,
    UserSyncResponse,
)

router = APIRouter(prefix="/users", tags=["users"])


def sync_user_from_firebase(db: Session, current_user: FirebaseUser) -> Tuple[User, bool]:
    """Firebase認証ユーザーをDBに同期（新規作成または更新）"""
    if not current_user.uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Firebase UID in token"
        )

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing email in Firebase token"
        )

    db_user = db.query(User).filter(User.firebase_uid == current_user.uid).first()

    if db_user:
        db_user.email = current_user.email
        db_user.name = current_user.name
        db.commit()
        db.refresh(db_user)
        return db_user, False

    db_user = User(
        firebase_uid=current_user.uid,
        email=current_user.email,
        name=current_user.name,
    )

    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user, True
    except IntegrityError:
        # 競合時（同時ログイン等）はロールバックして既存行を取得
        db.rollback()
        existing_user = db.query(User).filter(User.firebase_uid == current_user.uid).first()
        if not existing_user:
            raise

        existing_user.email = current_user.email
        existing_user.name = current_user.name
        db.commit()
        db.refresh(existing_user)
        return existing_user, False


@router.post("/sync", response_model=UserSyncResponse)
def sync_current_user(
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user)
):
    """認証ユーザー情報をDBへ同期する"""
    user, created = sync_user_from_firebase(db, current_user)
    return UserSyncResponse(user=UserResponse.model_validate(user), created=created)


@router.get("/me", response_model=UserResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user)
):
    """自分のユーザー情報を取得（未登録なら同期して返す）"""
    db_user = db.query(User).filter(User.firebase_uid == current_user.uid).first()
    if not db_user or not db_user.email:
        db_user, _ = sync_user_from_firebase(db, current_user)

    return UserResponse.model_validate(db_user)


@router.put("/me/notification-settings", response_model=UserResponse)
def update_notification_settings(
    payload: UserNotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """通知設定（メール受信可否）を更新"""
    db_user, _ = sync_user_from_firebase(db, current_user)
    db_user.email_opt_in = payload.email_opt_in
    db.commit()
    db.refresh(db_user)
    return UserResponse.model_validate(db_user)


@router.post("/me/location", response_model=UserResponse)
def update_my_location(
    payload: UserLocationUpdate,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    """現在地を更新（通知対象抽出用）"""
    db_user, _ = sync_user_from_firebase(db, current_user)
    db_user.latitude = payload.latitude
    db_user.longitude = payload.longitude
    db_user.location = func.ST_SetSRID(func.ST_MakePoint(payload.longitude, payload.latitude), 4326)
    db_user.location_updated_at = datetime.now()
    db.commit()
    db.refresh(db_user)
    return UserResponse.model_validate(db_user)
