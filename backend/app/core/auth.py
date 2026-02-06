"""
Firebase Authentication Middleware for FastAPI
"""
import logging
import os
from typing import Any, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth, credentials
from google.auth.exceptions import DefaultCredentialsError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token
from app.core.config import settings

logger = logging.getLogger(__name__)

# Firebase Admin SDK初期化
_firebase_initialized = False

def initialize_firebase():
    """Firebase Admin SDKを初期化"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    try:
        options = {}
        if settings.FIREBASE_PROJECT_ID:
            options["projectId"] = settings.FIREBASE_PROJECT_ID

        # Cloud Run環境では自動的にADCを使用
        # ローカル開発環境ではFIREBASE_SERVICE_ACCOUNT_KEYを使用
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        
        if service_account_path and os.path.exists(service_account_path):
            # ローカル開発: サービスアカウントキーを使用
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred, options=options or None)
        else:
            # Cloud Run: デフォルト認証情報を使用
            firebase_admin.initialize_app(options=options or None)
        
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.warning("Firebase Admin SDK initialization error: %s", e)
        # 初期化に失敗してもアプリケーションは起動する（開発環境用）


# HTTPベアラートークン認証スキーム
security = HTTPBearer(auto_error=False)


class FirebaseUser:
    """Firebase認証ユーザー情報"""
    
    def __init__(self, uid: str, email: Optional[str] = None, name: Optional[str] = None):
        self.uid = uid
        self.email = email
        self.name = name
    
    def __repr__(self):
        return f"FirebaseUser(uid={self.uid}, email={self.email})"


def _verify_id_token_with_public_keys(token: str):
    """
    ADCなしローカル環境向けのFirebaseトークン検証フォールバック。
    Firebase公開鍵を使ってトークンを検証する。
    """
    request = GoogleAuthRequest()
    return google_id_token.verify_firebase_token(
        token,
        request,
        audience=settings.FIREBASE_PROJECT_ID
    )


def _is_default_credentials_error(error: Exception) -> bool:
    """例外チェーンをたどって公開鍵フォールバック対象か判定する"""
    if isinstance(error, DefaultCredentialsError):
        return True

    message = str(error).lower()
    if "default credentials were not found" in message:
        return True

    if "default firebase app does not exist" in message:
        return True

    cause = getattr(error, "__cause__", None)
    if isinstance(cause, Exception):
        return _is_default_credentials_error(cause)

    return False


def _verify_with_public_key_fallback(token: str, error: Exception) -> dict[str, Any]:
    """ADCが使えない環境向けに公開鍵検証でフォールバックする"""
    if settings.DEBUG:
        logger.warning("ADC not found. Fallback to public key verification: %s", error)

    try:
        decoded_token = _verify_id_token_with_public_keys(token)
    except ValueError as fallback_error:
        logger.warning("Invalid Firebase token (fallback): %s", fallback_error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )
    except Exception as fallback_error:
        logger.warning("Firebase fallback verification failed: %s", fallback_error)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

    if not decoded_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )

    return decoded_token


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
        if settings.DEBUG:
            logger.warning("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    token = credentials.credentials

    try:
        # Firebase IDトークンを検証
        decoded_token = auth.verify_id_token(token)
    except auth.InvalidIdTokenError as e:
        logger.warning("Invalid Firebase token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )
    except auth.ExpiredIdTokenError as e:
        logger.warning("Expired Firebase token: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired Firebase token"
        )
    except Exception as e:
        if _is_default_credentials_error(e):
            decoded_token = _verify_with_public_key_fallback(token, e)
        else:
            logger.warning("Firebase token verification failed: %s", e)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )

    # ユーザー情報を取得
    # Firebase Admin SDKの検証結果はuid、公開鍵フォールバックはuser_id/subになる
    uid = (
        decoded_token.get("uid")
        or decoded_token.get("user_id")
        or decoded_token.get("sub")
    )
    email = decoded_token.get("email")
    name = decoded_token.get("name") or decoded_token.get("display_name")

    if not uid:
        logger.warning("Firebase token missing uid claims. keys=%s", list(decoded_token.keys()))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )

    if settings.DEBUG:
        logger.info("Firebase token verified: uid=%s, email=%s", uid, email)

    return FirebaseUser(uid=uid, email=email, name=name)


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
