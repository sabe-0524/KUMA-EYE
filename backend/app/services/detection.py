"""
Bear Detection System - YOLO Detection Service
"""
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from PIL import Image
import numpy as np
from datetime import datetime

from app.core.config import settings


class BearDetectionService:
    """
    YOLOv8を使用した熊検出サービス
    
    カスタムモデル: クラス0が「bear」
    COCOモデル: クラス21が「bear」
    """
    
    BEAR_CLASS_NAME = "bear"
    BEAR_CLASS_IDS = [0, 21]  # カスタムモデル(0) と COCO(21) 両方に対応
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Args:
            model_path: YOLOモデルのパス。未指定の場合はsettings.MODEL_PATHを使用
        """
        self.model_path = model_path or settings.MODEL_PATH
        self.confidence_threshold = settings.DETECTION_CONFIDENCE_THRESHOLD
        self.model = None
        self._load_model()
    
    def _load_model(self):
        """モデルをロード"""
        try:
            from ultralytics import YOLO
            
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found: {self.model_path}")

            # カスタムモデルを使用
            self.model = YOLO(self.model_path)
            print(f"Loaded custom model from: {self.model_path}")
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            self.model = None
    
    def detect(self, image: Image.Image) -> List[Dict]:
        """
        画像から熊を検出
        
        Args:
            image: PIL Image
            
        Returns:
            List[Dict]: 検出結果のリスト
            [
                {
                    "class_name": "bear",
                    "confidence": 0.95,
                    "bbox": {"x": 100, "y": 150, "width": 200, "height": 180}
                }
            ]
        """
        if self.model is None:
            print("Model not loaded, returning empty detections")
            return []
        
        try:
            # YOLO推論実行
            results = self.model(image, conf=self.confidence_threshold, verbose=False)
            
            detections = []
            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls)
                    class_name = result.names[class_id]
                    
                    # 熊クラスを抽出（名前またはID）
                    if class_name.lower() == self.BEAR_CLASS_NAME or class_id in self.BEAR_CLASS_IDS:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        detections.append({
                            "class_name": "bear",
                            "confidence": float(box.conf),
                            "bbox": {
                                "x": int(x1),
                                "y": int(y1),
                                "width": int(x2 - x1),
                                "height": int(y2 - y1)
                            }
                        })
            
            return detections
            
        except Exception as e:
            print(f"Error during detection: {e}")
            return []
    
    def detect_from_path(self, image_path: str) -> List[Dict]:
        """
        画像ファイルパスから熊を検出
        
        Args:
            image_path: 画像ファイルのパス
            
        Returns:
            List[Dict]: 検出結果
        """
        try:
            image = Image.open(image_path)
            return self.detect(image)
        except Exception as e:
            print(f"Error loading image {image_path}: {e}")
            return []
    
    def calculate_alert_level(self, detections: List[Dict]) -> Optional[str]:
        """
        検出結果から警報レベルを判定
        
        Args:
            detections: 検出結果のリスト
            
        Returns:
            str: 警報レベル (critical, warning, caution, low) または None
        """
        if not detections:
            return None
        
        max_confidence = max(d["confidence"] for d in detections)
        bear_count = len(detections)
        
        # 警報レベル判定
        # - critical: 信頼度 >= 90% または 複数頭検出
        # - warning: 信頼度 >= 70%
        # - caution: 信頼度 >= 50%
        # - low: 信頼度 < 50%
        
        if max_confidence >= 0.9 or bear_count >= 2:
            return "critical"
        elif max_confidence >= 0.7:
            return "warning"
        elif max_confidence >= 0.5:
            return "caution"
        else:
            return "low"
    
    def create_alert_message(
        self, 
        detections: List[Dict], 
        alert_level: str,
        camera_name: Optional[str] = None,
        location: Optional[Tuple[float, float]] = None
    ) -> str:
        """
        警報メッセージを生成
        
        Args:
            detections: 検出結果
            alert_level: 警報レベル
            camera_name: カメラ名
            location: (緯度, 経度)
            
        Returns:
            str: 警報メッセージ
        """
        bear_count = len(detections)
        max_confidence = max(d["confidence"] for d in detections) if detections else 0
        
        level_emoji = {
            "critical": "🚨",
            "warning": "⚠️",
            "caution": "⚡",
            "low": "ℹ️"
        }
        
        level_text = {
            "critical": "【危険】",
            "warning": "【警戒】",
            "caution": "【注意】",
            "low": "【情報】"
        }
        
        emoji = level_emoji.get(alert_level, "🐻")
        text = level_text.get(alert_level, "")
        
        message_parts = [f"{emoji} {text}熊を検出しました！"]
        
        if camera_name:
            message_parts.append(f"場所: {camera_name}")
        elif location:
            message_parts.append(f"位置: 緯度{location[0]:.6f}, 経度{location[1]:.6f}")
        
        message_parts.append(f"信頼度: {max_confidence*100:.1f}%")
        
        if bear_count > 1:
            message_parts.append(f"検出数: {bear_count}頭")
        
        return " / ".join(message_parts)
    
    def draw_detections(
        self, 
        image: Image.Image, 
        detections: List[Dict],
        output_path: Optional[str] = None
    ) -> Image.Image:
        """
        検出結果を画像に描画
        
        Args:
            image: 元画像
            detections: 検出結果
            output_path: 保存先パス（オプション）
            
        Returns:
            Image.Image: 注釈付き画像
        """
        from PIL import ImageDraw, ImageFont
        
        # 画像をコピー
        annotated = image.copy()
        draw = ImageDraw.Draw(annotated)
        
        # フォント設定（システムフォントがない場合はデフォルト）
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        except:
            font = ImageFont.load_default()
        
        # 色設定
        box_color = (255, 0, 0)  # 赤
        text_color = (255, 255, 255)  # 白
        text_bg_color = (255, 0, 0)  # 赤
        
        for det in detections:
            bbox = det["bbox"]
            conf = det["confidence"]
            
            # バウンディングボックス描画
            x1, y1 = bbox["x"], bbox["y"]
            x2, y2 = x1 + bbox["width"], y1 + bbox["height"]
            
            draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)
            
            # ラベル描画
            label = f"Bear {conf*100:.1f}%"
            
            # テキストサイズ取得
            text_bbox = draw.textbbox((x1, y1), label, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            # テキスト背景
            draw.rectangle(
                [x1, y1 - text_height - 4, x1 + text_width + 4, y1],
                fill=text_bg_color
            )
            
            # テキスト
            draw.text((x1 + 2, y1 - text_height - 2), label, fill=text_color, font=font)
        
        # 保存
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            annotated.save(output_path)
        
        return annotated


# シングルトンインスタンス
_detection_service: Optional[BearDetectionService] = None


def get_detection_service() -> BearDetectionService:
    """検出サービスのシングルトンを取得"""
    global _detection_service
    if _detection_service is None:
        _detection_service = BearDetectionService()
    return _detection_service
