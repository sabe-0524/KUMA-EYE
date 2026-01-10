"""
Bear Detection System - Uploads API
"""
import os
import shutil
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
from app.services.video_processor import get_video_processor

router = APIRouter(prefix="/uploads", tags=["uploads"])


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


@router.post("", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: Optional[int] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    recorded_at: Optional[datetime] = Form(None),
    frame_interval: int = Form(5),
    db: Session = Depends(get_db)
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
