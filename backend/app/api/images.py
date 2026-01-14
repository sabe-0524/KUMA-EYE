"""
Bear Detection System - Images API
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter(prefix="/images", tags=["images"])


@router.get("/{path:path}")
async def get_image(path: str):
    """
    画像ファイルを配信
    
    パス例: /api/v1/images/processed/1/detected_000001.jpg
    または: /api/v1/images/storage/processed/1/detected_000001.jpg
    """
    # "storage/" プレフィックスを除去（DBに保存されたパスとの互換性）
    if path.startswith("storage/"):
        path = path[8:]  # "storage/" を除去
    
    # ストレージパスと結合
    storage_path = Path(settings.LOCAL_STORAGE_PATH)
    file_path = storage_path / path
    
    # セキュリティチェック: パストラバーサル防止
    try:
        file_path = file_path.resolve()
        storage_path = storage_path.resolve()
        
        if not str(file_path).startswith(str(storage_path)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path"
        )
    
    # ファイル存在チェック
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image not found: {path}"
        )
    
    # ファイルタイプチェック
    suffix = file_path.suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    
    media_type = media_types.get(suffix)
    if not media_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {suffix}"
        )
    
    return FileResponse(
        path=file_path,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600"  # 1時間キャッシュ
        }
    )
