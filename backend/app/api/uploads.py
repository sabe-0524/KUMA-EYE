"""Bear Detection System - Uploads API."""

import os
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import FirebaseUser, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.database import Camera, Sighting, Upload
from app.models.schemas import UploadDetailResponse, UploadResponse, UploadStatus
from app.services.video_processor import get_video_processor
from app.workers.dispatcher import enqueue_upload_processing

router = APIRouter(prefix="/uploads", tags=["uploads"])


def get_file_type(content_type: str | None) -> Optional[str]:
    """Determine file type from Content-Type."""
    if content_type in settings.ALLOWED_IMAGE_TYPES.split(","):
        return "image"
    if content_type in settings.ALLOWED_VIDEO_TYPES.split(","):
        return "video"
    return None


def _resolve_safe_zip_path(name: str, base_dir: Path) -> Optional[Path]:
    """Validate ZIP entry name and return a safe extraction path."""
    if not name:
        return None

    path = Path(name)
    if path.is_absolute():
        return None

    if len(path.parts) != 1:
        return None

    base_dir = base_dir.resolve()
    try:
        target_path = (base_dir / path).resolve()
    except Exception:
        return None

    if target_path == base_dir or base_dir not in target_path.parents:
        return None

    return target_path


@router.post("", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_upload(
    file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    recorded_at: Optional[datetime] = Form(None),
    frame_interval: int = Form(5),
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Upload a video/image and enqueue bear detection processing."""
    file_type = get_file_type(file.content_type)
    if not file_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type: {file.content_type}. "
                f"Allowed: {settings.ALLOWED_IMAGE_TYPES}, {settings.ALLOWED_VIDEO_TYPES}"
            ),
        )

    if camera_id:
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {camera_id} not found",
            )
    elif latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either camera_id or both latitude and longitude must be provided",
        )

    storage_path = Path(settings.LOCAL_STORAGE_PATH)
    upload_dir = storage_path / ("videos" if file_type == "video" else "images")
    upload_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    db_upload = Upload(
        camera_id=camera_id,
        file_path=str(file_path),
        file_type=file_type,
        file_size=file_size,
        recorded_at=recorded_at,
        status="pending",
        latitude=latitude,
        longitude=longitude,
    )

    db.add(db_upload)
    db.commit()
    db.refresh(db_upload)

    enqueue_upload_processing(db_upload.id, frame_interval)

    estimated_time = 30 if file_type == "video" else None

    return UploadResponse(
        upload_id=db_upload.id,
        status=UploadStatus.PROCESSING,
        message="映像の処理を開始しました",
        estimated_time_seconds=estimated_time,
    )


@router.post("/frames", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_frame_upload(
    zip_file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    recorded_at: Optional[datetime] = Form(None),
    frame_interval: int = Form(5),
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """Upload frame ZIP and enqueue bear detection processing."""
    if not zip_file.filename or not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIPファイルを指定してください",
        )

    if camera_id:
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {camera_id} not found",
            )
    elif latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either camera_id or both latitude and longitude must be provided",
        )

    storage_path = Path(settings.LOCAL_STORAGE_PATH)
    upload_dir = storage_path / "frames"
    upload_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{zip_file.filename}"
    zip_path = upload_dir / filename

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    total_read = 0
    with open(zip_path, "wb") as buffer:
        while True:
            chunk = zip_file.file.read(1024 * 1024)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > max_bytes:
                buffer.close()
                zip_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="ZIPファイルが大きすぎます",
                )
            buffer.write(chunk)

    file_size = os.path.getsize(zip_path)

    db_upload = Upload(
        camera_id=camera_id,
        file_path=str(zip_path),
        file_type="image",
        file_size=file_size,
        recorded_at=recorded_at,
        status="pending",
        latitude=latitude,
        longitude=longitude,
    )

    db.add(db_upload)
    db.commit()
    db.refresh(db_upload)

    extracted_dir = upload_dir / str(db_upload.id)
    extracted_dir.mkdir(parents=True, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            members = [m for m in zip_ref.namelist() if not m.endswith("/")]
            if not members:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ZIP内にファイルがありません",
                )

            total_extracted = 0
            for member in members:
                safe_path = _resolve_safe_zip_path(member, extracted_dir)
                if safe_path is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="ZIP内のパスが不正です",
                    )

                info = zip_ref.getinfo(member)
                if info.file_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="ZIP内のファイルが大きすぎます",
                    )

                total_extracted += info.file_size
                if total_extracted > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="ZIP展開後の合計サイズが大きすぎます",
                    )

                with zip_ref.open(member) as source, open(safe_path, "wb") as dest:
                    shutil.copyfileobj(source, dest)
    except HTTPException:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ZIPの展開に失敗しました: {exc}",
        )

    image_files = get_video_processor(frame_interval).list_frame_files(str(extracted_dir))
    if not image_files:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIP内に対応画像がありません",
        )

    enqueue_upload_processing(db_upload.id, frame_interval, str(extracted_dir))

    return UploadResponse(
        upload_id=db_upload.id,
        status=UploadStatus.PROCESSING,
        message="フレーム画像の処理を開始しました",
        estimated_time_seconds=None,
    )


@router.get("/{upload_id}", response_model=UploadDetailResponse)
def get_upload(upload_id: int, db: Session = Depends(get_db)):
    """Get upload status and metadata."""
    upload = db.query(Upload).filter(Upload.id == upload_id).first()

    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found",
        )

    sighting_count = db.query(Sighting).filter(Sighting.upload_id == upload_id).count()

    return UploadDetailResponse(
        id=upload.id,
        camera_id=upload.camera_id,
        file_path=upload.file_path,
        file_type=upload.file_type,
        file_size=upload.file_size,
        duration_seconds=upload.duration_seconds,
        uploaded_at=upload.uploaded_at,
        recorded_at=upload.recorded_at,
        processed_at=upload.processed_at,
        status=upload.status,
        frame_count=upload.frame_count,
        error_message=upload.error_message,
        latitude=float(upload.latitude) if upload.latitude else None,
        longitude=float(upload.longitude) if upload.longitude else None,
        sighting_count=sighting_count,
    )


@router.get("", response_model=list)
def list_uploads(
    status: Optional[str] = None,
    camera_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Get upload list."""
    query = db.query(Upload)

    if status:
        query = query.filter(Upload.status == status)
    if camera_id:
        query = query.filter(Upload.camera_id == camera_id)

    uploads = query.order_by(Upload.uploaded_at.desc()).offset(offset).limit(limit).all()

    result = []
    for upload in uploads:
        sighting_count = db.query(Sighting).filter(Sighting.upload_id == upload.id).count()
        result.append(
            {
                "id": upload.id,
                "camera_id": upload.camera_id,
                "file_type": upload.file_type,
                "status": upload.status,
                "uploaded_at": upload.uploaded_at,
                "processed_at": upload.processed_at,
                "sighting_count": sighting_count,
            }
        )

    return result
