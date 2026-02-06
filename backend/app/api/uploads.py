"""
Bear Detection System - Uploads API
"""
import logging
import os
import shutil
import zipfile
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.core.auth import get_current_user, FirebaseUser
from app.models.database import Upload, Camera, Sighting, Detection, Alert, Job
from app.models.schemas import (
    UploadResponse, 
    UploadDetailResponse,
    UploadStatus,
    FileType
)
from app.services.detection import get_detection_service
from app.services.notification_service import notify_for_alert
from app.services.video_processor import get_video_processor

router = APIRouter(prefix="/uploads", tags=["uploads"])
logger = logging.getLogger(__name__)
NOTIFIABLE_ALERT_LEVELS = {"critical", "warning", "caution"}


def get_file_type(content_type: str) -> Optional[str]:
    """Content-Typeからファイルタイプを判定"""
    if content_type in settings.ALLOWED_IMAGE_TYPES.split(","):
        return "image"
    elif content_type in settings.ALLOWED_VIDEO_TYPES.split(","):
        return "video"
    return None


def process_upload(upload_id: int, frame_interval: int = 5):
    """
    バックグラウンドでアップロードを処理
    
    1. 動画の場合はフレーム抽出
    2. 各フレームで熊検出
    3. 検出結果をDBに保存
    4. 警報を生成
    """
    from app.core.database import SessionLocal
    
    db = SessionLocal()
    
    try:
        # アップロード取得
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            return
        
        # ステータス更新
        upload.status = "processing"
        db.commit()
        
        # カメラ情報取得（位置情報用）
        camera = None
        if upload.camera_id:
            camera = db.query(Camera).filter(Camera.id == upload.camera_id).first()
        
        # 位置情報決定
        if camera:
            latitude = float(camera.latitude)
            longitude = float(camera.longitude)
            camera_name = camera.name
        else:
            latitude = float(upload.latitude) if upload.latitude else 0.0
            longitude = float(upload.longitude) if upload.longitude else 0.0
            camera_name = None
        
        # 検出サービス取得
        detection_service = get_detection_service()
        video_processor = get_video_processor(frame_interval)
        
        file_path = upload.file_path
        frame_count = 0
        sighting_count = 0
        notification_dispatched = False
        
        if upload.file_type == "video":
            # 動画処理
            video_info = video_processor.get_video_info(file_path)
            upload.duration_seconds = int(video_info.get("duration", 0))
            
            # フレーム抽出と検出
            for frame_num, frame_path, pil_image in video_processor.extract_frames(file_path):
                frame_count += 1
                
                # 熊検出
                detections = detection_service.detect(pil_image)
                
                if detections:
                    # 警報レベル計算
                    alert_level = detection_service.calculate_alert_level(detections)
                    max_confidence = max(d["confidence"] for d in detections)
                    bear_count = len(detections)
                    
                    # 検出画像を保存
                    annotated_image = detection_service.draw_detections(pil_image, detections)
                    processed_path = video_processor.save_processed_frame(
                        annotated_image, upload_id, frame_num
                    )
                    
                    # Sighting作成
                    sighting = Sighting(
                        upload_id=upload_id,
                        location=func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                        latitude=latitude,
                        longitude=longitude,
                        detected_at=datetime.now(),
                        confidence=max_confidence,
                        bear_count=bear_count,
                        alert_level=alert_level,
                        image_path=processed_path,
                        frame_number=frame_num
                    )
                    db.add(sighting)
                    db.flush()
                    
                    # Detection詳細を保存
                    for det in detections:
                        detection = Detection(
                            sighting_id=sighting.id,
                            class_name=det["class_name"],
                            confidence=det["confidence"],
                            bbox_x=det["bbox"]["x"],
                            bbox_y=det["bbox"]["y"],
                            bbox_w=det["bbox"]["width"],
                            bbox_h=det["bbox"]["height"]
                        )
                        db.add(detection)
                    
                    # Alert作成
                    alert_message = detection_service.create_alert_message(
                        detections, 
                        alert_level, 
                        camera_name=camera_name,
                        location=(latitude, longitude)
                    )
                    alert = Alert(
                        sighting_id=sighting.id,
                        alert_level=alert_level,
                        message=alert_message
                    )
                    db.add(alert)
                    
                    sighting_count += 1
                    db.commit()

                    if not notification_dispatched and alert_level in NOTIFIABLE_ALERT_LEVELS:
                        try:
                            notify_for_alert(db, alert.id)
                        except Exception:
                            logger.exception("Notification failed for alert_id=%s", alert.id)
                        notification_dispatched = True
        
        else:
            # 画像処理
            from PIL import Image
            pil_image = Image.open(file_path)
            
            detections = detection_service.detect(pil_image)
            frame_count = 1
            
            if detections:
                alert_level = detection_service.calculate_alert_level(detections)
                max_confidence = max(d["confidence"] for d in detections)
                bear_count = len(detections)
                
                # 検出画像を保存
                annotated_image = detection_service.draw_detections(pil_image, detections)
                processed_path = video_processor.save_processed_frame(
                    annotated_image, upload_id, 0
                )
                
                # Sighting作成
                sighting = Sighting(
                    upload_id=upload_id,
                    location=func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                    latitude=latitude,
                    longitude=longitude,
                    detected_at=datetime.now(),
                    confidence=max_confidence,
                    bear_count=bear_count,
                    alert_level=alert_level,
                    image_path=processed_path,
                    frame_number=0
                )
                db.add(sighting)
                db.flush()
                
                # Detection詳細を保存
                for det in detections:
                    detection = Detection(
                        sighting_id=sighting.id,
                        class_name=det["class_name"],
                        confidence=det["confidence"],
                        bbox_x=det["bbox"]["x"],
                        bbox_y=det["bbox"]["y"],
                        bbox_w=det["bbox"]["width"],
                        bbox_h=det["bbox"]["height"]
                    )
                    db.add(detection)
                
                # Alert作成
                alert_message = detection_service.create_alert_message(
                    detections, 
                    alert_level, 
                    camera_name=camera_name,
                    location=(latitude, longitude)
                )
                alert = Alert(
                    sighting_id=sighting.id,
                    alert_level=alert_level,
                    message=alert_message
                )
                db.add(alert)
                
                sighting_count += 1
                db.commit()

                if not notification_dispatched and alert_level in NOTIFIABLE_ALERT_LEVELS:
                    try:
                        notify_for_alert(db, alert.id)
                    except Exception:
                        logger.exception("Notification failed for alert_id=%s", alert.id)
                    notification_dispatched = True
        
        # 処理完了
        upload.status = "completed"
        upload.frame_count = frame_count
        upload.processed_at = datetime.now()
        db.commit()
        
        print(f"Upload {upload_id} processed: {frame_count} frames, {sighting_count} sightings")
        
    except Exception as e:
        print(f"Error processing upload {upload_id}: {e}")
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if upload:
            upload.status = "failed"
            upload.error_message = str(e)
            db.commit()
    
    finally:
        db.close()


def process_frame_upload(upload_id: int, frames_dir: str, frame_interval: int = 5):
    """
    フレーム画像のZIPアップロードを処理

    1. フレーム画像を順に処理
    2. 各フレームで熊検出
    3. 検出結果をDBに保存
    4. 警報を生成
    """
    from app.core.database import SessionLocal
    from PIL import Image

    db = SessionLocal()

    try:
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            return

        upload.status = "processing"
        db.commit()

        camera = None
        if upload.camera_id:
            camera = db.query(Camera).filter(Camera.id == upload.camera_id).first()

        if camera:
            latitude = float(camera.latitude)
            longitude = float(camera.longitude)
            camera_name = camera.name
        else:
            latitude = float(upload.latitude) if upload.latitude else 0.0
            longitude = float(upload.longitude) if upload.longitude else 0.0
            camera_name = None

        detection_service = get_detection_service()
        video_processor = get_video_processor(frame_interval)

        frame_count = 0
        sighting_count = 0
        notification_dispatched = False

        frame_paths = video_processor.list_frame_files(frames_dir)
        for frame_num, frame_path in enumerate(frame_paths):
            try:
                pil_image = Image.open(frame_path)
            except Exception:
                continue

            frame_count += 1
            detections = detection_service.detect(pil_image)

            if detections:
                alert_level = detection_service.calculate_alert_level(detections)
                max_confidence = max(d["confidence"] for d in detections)
                bear_count = len(detections)

                annotated_image = detection_service.draw_detections(pil_image, detections)
                processed_path = video_processor.save_processed_frame(
                    annotated_image, upload_id, frame_num
                )

                sighting = Sighting(
                    upload_id=upload_id,
                    location=func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326),
                    latitude=latitude,
                    longitude=longitude,
                    detected_at=datetime.now(),
                    confidence=max_confidence,
                    bear_count=bear_count,
                    alert_level=alert_level,
                    image_path=processed_path,
                    frame_number=frame_num
                )
                db.add(sighting)
                db.flush()

                for det in detections:
                    detection = Detection(
                        sighting_id=sighting.id,
                        class_name=det["class_name"],
                        confidence=det["confidence"],
                        bbox_x=det["bbox"]["x"],
                        bbox_y=det["bbox"]["y"],
                        bbox_w=det["bbox"]["width"],
                        bbox_h=det["bbox"]["height"]
                    )
                    db.add(detection)

                alert_message = detection_service.create_alert_message(
                    detections,
                    alert_level,
                    camera_name=camera_name,
                    location=(latitude, longitude)
                )
                alert = Alert(
                    sighting_id=sighting.id,
                    alert_level=alert_level,
                    message=alert_message
                )
                db.add(alert)

                sighting_count += 1
                db.commit()

                if not notification_dispatched and alert_level in NOTIFIABLE_ALERT_LEVELS:
                    try:
                        notify_for_alert(db, alert.id)
                    except Exception:
                        logger.exception("Notification failed for alert_id=%s", alert.id)
                    notification_dispatched = True

        upload.status = "completed"
        upload.frame_count = frame_count
        upload.duration_seconds = frame_count * frame_interval if frame_interval else None
        upload.processed_at = datetime.now()
        db.commit()

        print(f"Frame upload {upload_id} processed: {frame_count} frames, {sighting_count} sightings")

    except Exception as e:
        print(f"Error processing frame upload {upload_id}: {e}")
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if upload:
            upload.status = "failed"
            upload.error_message = str(e)
            db.commit()
    finally:
        try:
            shutil.rmtree(frames_dir, ignore_errors=True)
        except Exception:
            pass
        db.close()


def _resolve_safe_zip_path(name: str, base_dir: Path) -> Optional[Path]:
    """
    ZIP内のエントリ名が安全かを検証し、展開先パスを返す
    """
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    recorded_at: Optional[datetime] = Form(None),
    frame_interval: int = Form(5),
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """
    映像（動画または画像）をアップロードし、熊検出処理を開始
    
    - camera_id: 登録済みカメラIDを指定
    - または latitude/longitude: 位置情報を直接指定
    """
    # ファイルタイプチェック
    file_type = get_file_type(file.content_type)
    if not file_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {settings.ALLOWED_IMAGE_TYPES}, {settings.ALLOWED_VIDEO_TYPES}"
        )
    
    # カメラIDまたは位置情報のチェック
    if camera_id:
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {camera_id} not found"
            )
    elif latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either camera_id or both latitude and longitude must be provided"
        )
    
    # ファイル保存
    storage_path = Path(settings.LOCAL_STORAGE_PATH)
    if file_type == "video":
        upload_dir = storage_path / "videos"
    else:
        upload_dir = storage_path / "images"
    
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # ユニークなファイル名生成
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_ext = Path(file.filename).suffix or (".mp4" if file_type == "video" else ".jpg")
    filename = f"{timestamp}_{file.filename}"
    file_path = upload_dir / filename
    
    # ファイル保存
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_size = os.path.getsize(file_path)
    
    # DBレコード作成
    db_upload = Upload(
        camera_id=camera_id,
        file_path=str(file_path),
        file_type=file_type,
        file_size=file_size,
        recorded_at=recorded_at,
        status="pending",
        latitude=latitude,
        longitude=longitude
    )
    
    db.add(db_upload)
    db.commit()
    db.refresh(db_upload)
    
    # バックグラウンド処理開始
    background_tasks.add_task(process_upload, db_upload.id, frame_interval)
    
    # 推定処理時間（動画の場合）
    estimated_time = None
    if file_type == "video":
        # ざっくり1分の動画で30秒程度と仮定
        estimated_time = 30
    
    return UploadResponse(
        upload_id=db_upload.id,
        status=UploadStatus.PROCESSING,
        message="映像の処理を開始しました",
        estimated_time_seconds=estimated_time
    )


@router.post("/frames", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_frame_upload(
    background_tasks: BackgroundTasks,
    zip_file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    recorded_at: Optional[datetime] = Form(None),
    frame_interval: int = Form(5),
    db: Session = Depends(get_db),
    _current_user: FirebaseUser = Depends(get_current_user),
):
    """
    フレーム画像ZIPをアップロードし、熊検出処理を開始
    """
    if not zip_file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIPファイルを指定してください"
        )

    if camera_id:
        camera = db.query(Camera).filter(Camera.id == camera_id).first()
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {camera_id} not found"
            )
    elif latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either camera_id or both latitude and longitude must be provided"
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
                    detail="ZIPファイルが大きすぎます"
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
        longitude=longitude
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
                    detail="ZIP内にファイルがありません"
                )
            total_extracted = 0
            for member in members:
                safe_path = _resolve_safe_zip_path(member, extracted_dir)
                if safe_path is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="ZIP内のパスが不正です"
                    )

                info = zip_ref.getinfo(member)
                if info.file_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="ZIP内のファイルが大きすぎます"
                    )

                total_extracted += info.file_size
                if total_extracted > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="ZIP展開後の合計サイズが大きすぎます"
                    )

                with zip_ref.open(member) as source, open(safe_path, "wb") as dest:
                    shutil.copyfileobj(source, dest)
    except HTTPException:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(extracted_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ZIPの展開に失敗しました: {e}"
        )

    image_files = get_video_processor(frame_interval).list_frame_files(str(extracted_dir))
    if not image_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ZIP内に対応画像がありません"
        )

    background_tasks.add_task(process_frame_upload, db_upload.id, str(extracted_dir), frame_interval)

    return UploadResponse(
        upload_id=db_upload.id,
        status=UploadStatus.PROCESSING,
        message="フレーム画像の処理を開始しました",
        estimated_time_seconds=None
    )


@router.get("/{upload_id}", response_model=UploadDetailResponse)
def get_upload(upload_id: int, db: Session = Depends(get_db)):
    """
    アップロード状態を取得
    """
    upload = db.query(Upload).filter(Upload.id == upload_id).first()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Upload with id {upload_id} not found"
        )
    
    # 目撃数をカウント
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
        sighting_count=sighting_count
    )


@router.get("", response_model=list)
def list_uploads(
    status: Optional[str] = None,
    camera_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    アップロード一覧を取得
    """
    query = db.query(Upload)
    
    if status:
        query = query.filter(Upload.status == status)
    if camera_id:
        query = query.filter(Upload.camera_id == camera_id)
    
    uploads = query.order_by(Upload.uploaded_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for upload in uploads:
        sighting_count = db.query(Sighting).filter(Sighting.upload_id == upload.id).count()
        result.append({
            "id": upload.id,
            "camera_id": upload.camera_id,
            "file_type": upload.file_type,
            "status": upload.status,
            "uploaded_at": upload.uploaded_at,
            "processed_at": upload.processed_at,
            "sighting_count": sighting_count
        })
    
    return result
