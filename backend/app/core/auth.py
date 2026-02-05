"""
Firebase Authentication Middleware for FastAPI
"""
import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials
from app.core.config import settings
from jose import jwt
import logging

# Firebase Admin SDK初期化
_firebase_initialized = False

def initialize_firebase():
    """Firebase Admin SDKを初期化"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    try:
        # Cloud Run環境では自動的にADCを使用
        # ローカル開発環境ではFIREBASE_SERVICE_ACCOUNT_KEYを使用
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        
        options = {"projectId": settings.FIREBASE_PROJECT_ID}

        if service_account_path and os.path.exists(service_account_path):
            # ローカル開発: サービスアカウントキーを使用
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred, options)
        else:
            # Cloud Run: デフォルト認証情報を使用
            firebase_admin.initialize_app(options=options)
        
        _firebase_initialized = True
        print("✅ Firebase Admin SDK initialized successfully")
    except Exception as e:
        print(f"⚠️ Firebase Admin SDK initialization error: {e}")
        # 初期化に失敗してもアプリケーションは起動する（開発環境用）


# HTTPベアラートークン認証スキーム
security = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)


class FirebaseUser:
    """Firebase認証ユーザー情報"""
    
    def __init__(self, uid: str, email: Optional[str] = None, name: Optional[str] = None):
        self.uid = uid
        self.email = email
        self.name = name
    
    def __repr__(self):
        return f"FirebaseUser(uid={self.uid}, email={self.email})"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> FirebaseUser:
    """
    Firebase IDトークンを検証し、現在のユーザーを取得
    
    Args:
        credentials: HTTPベアラートークン
        
    Returns:
        FirebaseUser: 認証されたユーザー情報
        
    Raises:
        HTTPException: トークンが無効または期限切れの場合
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンがありません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Firebase IDトークンを検証
        decoded_token = auth.verify_id_token(token)

        # ユーザー情報を取得
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name")

        return FirebaseUser(uid=uid, email=email, name=name)

    except auth.InvalidIdTokenError as e:
        logger.warning("Firebase token invalid: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="無効な認証トークンです",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError as e:
        logger.warning("Firebase token expired: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証トークンの有効期限が切れています",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.warning("Firebase token verification error: %s", e)
        if settings.DEBUG:
            try:
                claims = jwt.get_unverified_claims(token)
                uid = claims.get("user_id") or claims.get("sub") or claims.get("uid")
                email = claims.get("email")
                name = claims.get("name")
                if uid:
                    logger.info("Using unverified Firebase claims in DEBUG mode (uid=%s)", uid)
                    return FirebaseUser(uid=uid, email=email, name=name)
            except Exception as decode_error:
                logger.warning("Failed to decode token claims: %s", decode_error)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"認証エラー: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[FirebaseUser]:
    """
    オプショナルな認証（トークンがない場合もエラーにしない）
    
    Args:
        credentials: HTTPベアラートークン（オプション）
        
    Returns:
        Optional[FirebaseUser]: 認証されたユーザー情報（トークンがない場合はNone）
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
