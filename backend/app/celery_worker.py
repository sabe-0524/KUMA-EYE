# Celery Worker for Bear Detection System

from celery import Celery
from sqlalchemy.orm import Session
from pathlib import Path
import logging

from app.core.config import settings
from app.core.database import get_db, engine
from app.models.database import Upload, Sighting, Detection, Alert
from app.models import database as models
from app.services.detection import BearDetectionService
from app.services.video_processor import VideoProcessor

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Celeryアプリケーション
celery_app = Celery(
    'bear_detection',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Celery設定
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Tokyo',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1時間
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


@celery_app.task(bind=True, max_retries=3)
def process_upload(self, upload_id: int, latitude: float, longitude: float, frame_interval: int = 5):
    """
    アップロードされた映像/画像を処理し、熊を検出するタスク
    """
    from sqlalchemy.orm import sessionmaker
    from datetime import datetime
    from PIL import Image
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # アップロード取得
        upload = db.query(Upload).filter(Upload.id == upload_id).first()
        if not upload:
            logger.error(f"Upload {upload_id} not found")
            return {"status": "failed", "error": "Upload not found"}
        
        # ステータス更新
        upload.status = 'processing'
        db.commit()
        
        logger.info(f"Processing upload {upload_id}: {upload.file_path}")
        
        # 検出サービス初期化
        try:
            detection_service = BearDetectionService()
        except Exception as e:
            logger.warning(f"Detection service unavailable: {e}")
            # モデルがない場合はダミー検出（デモ用）
            detection_service = None
        
        file_path = Path(upload.file_path)
        detections_found = []
        
        if upload.file_type == 'video':
            # 動画処理
            processor = VideoProcessor(frame_interval=frame_interval)
            frame_count = 0
            
            for frame_num, frame_image in processor.extract_frames(str(file_path)):
                frame_count += 1
                
                if detection_service:
                    detections = detection_service.detect(frame_image)
                else:
                    # モデルなしの場合はスキップ
                    detections = []
                
                if detections:
                    detections_found.append({
                        'frame_number': frame_num,
                        'detections': detections,
                        'image': frame_image
                    })
            
            upload.frame_count = frame_count
            
        elif upload.file_type == 'image':
            # 画像処理
            image = Image.open(file_path)
            
            if detection_service:
                detections = detection_service.detect(image)
            else:
                detections = []
            
            if detections:
                detections_found.append({
                    'frame_number': 0,
                    'detections': detections,
                    'image': image
                })
        
        # 検出結果をデータベースに保存
        sighting_ids = []
        for detection_data in detections_found:
            frame_num = detection_data['frame_number']
            detections = detection_data['detections']
            frame_image = detection_data['image']
            
            # 最大信頼度と頭数を計算
            max_confidence = max(d['confidence'] for d in detections)
            bear_count = len(detections)
            
            # 警報レベル判定
            if detection_service:
                alert_level = detection_service.calculate_alert_level(detections)
            else:
                alert_level = 'warning' if max_confidence >= 0.7 else 'caution'
            
            # 検出画像を保存
            sighting_image_dir = Path(settings.STORAGE_PATH) / 'sightings'
            sighting_image_dir.mkdir(parents=True, exist_ok=True)
            
            image_filename = f"sighting_{upload_id}_{frame_num}.jpg"
            image_path = sighting_image_dir / image_filename
            frame_image.save(str(image_path), 'JPEG', quality=85)
            
            # 目撃記録を作成
            sighting = Sighting(
                upload_id=upload_id,
                latitude=latitude,
                longitude=longitude,
                detected_at=upload.recorded_at or datetime.utcnow(),
                confidence=max_confidence,
                bear_count=bear_count,
                alert_level=alert_level,
                image_path=f"/sightings/{image_filename}",
                frame_number=frame_num
            )
            db.add(sighting)
            db.flush()
            
            # 検出詳細を作成
            for det in detections:
                detection = Detection(
                    sighting_id=sighting.id,
                    class_name=det['class_name'],
                    confidence=det['confidence'],
                    bbox_x=det['bbox']['x'],
                    bbox_y=det['bbox']['y'],
                    bbox_w=det['bbox']['width'],
                    bbox_h=det['bbox']['height']
                )
                db.add(detection)
            
            # 警報を作成
            alert_message = _generate_alert_message(
                alert_level=alert_level,
                confidence=max_confidence,
                bear_count=bear_count,
                camera_name=upload.camera.name if upload.camera else None
            )
            
            alert = Alert(
                sighting_id=sighting.id,
                alert_level=alert_level,
                message=alert_message
            )
            db.add(alert)
            
            sighting_ids.append(sighting.id)
        
        # アップロード完了
        upload.status = 'completed'
        upload.processed_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Upload {upload_id} completed. Found {len(sighting_ids)} sightings.")
        
        return {
            "status": "completed",
            "upload_id": upload_id,
            "sightings_count": len(sighting_ids),
            "sighting_ids": sighting_ids
        }
        
    except Exception as e:
        logger.exception(f"Error processing upload {upload_id}: {e}")
        
        # エラー状態を保存
        try:
            upload = db.query(Upload).filter(Upload.id == upload_id).first()
            if upload:
                upload.status = 'failed'
                upload.error_message = str(e)
                db.commit()
        except:
            pass
        
        # リトライ
        raise self.retry(exc=e, countdown=60)
        
    finally:
        db.close()


def _generate_alert_message(alert_level: str, confidence: float, bear_count: int, camera_name: str = None) -> str:
    """警報メッセージを生成"""
    level_labels = {
        'critical': '🔴 危険',
        'warning': '🟠 警戒',
        'caution': '🟡 注意',
        'low': '🔵 低'
    }
    
    label = level_labels.get(alert_level, '⚪ 不明')
    location = f"{camera_name}付近" if camera_name else "指定位置"
    
    if bear_count >= 2:
        return f"{label}：{location}で{bear_count}頭の熊を検出しました！（信頼度: {confidence:.0%}）"
    else:
        return f"{label}：{location}で熊を検出しました。（信頼度: {confidence:.0%}）"


# テスト用のダミータスク
@celery_app.task
def test_task():
    """Celery動作確認用タスク"""
    logger.info("Test task executed successfully")
    return {"status": "ok", "message": "Celery is working!"}
