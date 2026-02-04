"""
Bear Detection System - Video Processing Service
"""
import os
import subprocess
from pathlib import Path
from typing import Generator, Tuple, Optional, List
from datetime import datetime, timedelta
from PIL import Image
import json

from app.core.config import settings


class VideoProcessor:
    """
    動画からフレームを抽出するサービス
    """
    
    def __init__(self, frame_interval: int = None):
        """
        Args:
            frame_interval: フレーム抽出間隔（秒）
        """
        self.frame_interval = frame_interval or settings.DEFAULT_FRAME_INTERVAL_SECONDS
        self.storage_path = Path(settings.LOCAL_STORAGE_PATH)
    
    def get_video_info(self, video_path: str) -> dict:
        """
        動画のメタ情報を取得
        
        Args:
            video_path: 動画ファイルのパス
            
        Returns:
            dict: {
                "duration": float,  # 秒
                "fps": float,
                "width": int,
                "height": int,
                "frame_count": int
            }
        """
        try:
            cmd = [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                video_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            data = json.loads(result.stdout)
            
            # 動画ストリームを探す
            video_stream = None
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break
            
            if not video_stream:
                return {}
            
            # FPS計算
            fps_str = video_stream.get("r_frame_rate", "30/1")
            if "/" in fps_str:
                num, den = map(float, fps_str.split("/"))
                fps = num / den if den > 0 else 30.0
            else:
                fps = float(fps_str)
            
            duration = float(data.get("format", {}).get("duration", 0))
            
            return {
                "duration": duration,
                "fps": fps,
                "width": int(video_stream.get("width", 0)),
                "height": int(video_stream.get("height", 0)),
                "frame_count": int(duration * fps)
            }
            
        except Exception as e:
            print(f"Error getting video info: {e}")
            return {}
    
    def extract_frames(
        self, 
        video_path: str,
        output_dir: Optional[str] = None,
        frame_interval: Optional[int] = None
    ) -> Generator[Tuple[int, str, Image.Image], None, None]:
        """
        動画からフレームを抽出
        
        Args:
            video_path: 動画ファイルのパス
            output_dir: フレーム出力ディレクトリ
            frame_interval: フレーム抽出間隔（秒）
            
        Yields:
            Tuple[int, str, Image.Image]: (フレーム番号, 保存パス, PIL Image)
        """
        import cv2
        
        interval = frame_interval or self.frame_interval
        
        # 出力ディレクトリ設定
        if output_dir is None:
            video_name = Path(video_path).stem
            output_dir = self.storage_path / "frames" / video_name
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 動画を開く
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video {video_path}")
            return
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0
        
        frame_skip = int(fps * interval)
        if frame_skip <= 0:
            frame_skip = 1
        
        frame_count = 0
        extracted_count = 0
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                if frame_count % frame_skip == 0:
                    # BGR → RGB変換
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(rgb_frame)
                    
                    # フレーム保存
                    frame_filename = f"frame_{extracted_count:06d}.jpg"
                    frame_path = output_dir / frame_filename
                    pil_image.save(frame_path, "JPEG", quality=90)
                    
                    yield extracted_count, str(frame_path), pil_image
                    extracted_count += 1
                
                frame_count += 1
        
        finally:
            cap.release()
    
    def extract_frames_ffmpeg(
        self, 
        video_path: str,
        output_dir: Optional[str] = None,
        frame_interval: Optional[int] = None
    ) -> List[str]:
        """
        ffmpegを使用してフレームを抽出（高速）
        
        Args:
            video_path: 動画ファイルのパス
            output_dir: フレーム出力ディレクトリ
            frame_interval: フレーム抽出間隔（秒）
            
        Returns:
            List[str]: 抽出されたフレームのパスリスト
        """
        interval = frame_interval or self.frame_interval
        
        # 出力ディレクトリ設定
        if output_dir is None:
            video_name = Path(video_path).stem
            output_dir = self.storage_path / "frames" / video_name
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_pattern = str(output_dir / "frame_%06d.jpg")
        
        # ffmpegでフレーム抽出
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-vf", f"fps=1/{interval}",
            "-q:v", "2",  # JPEG品質
            "-y",  # 上書き
            output_pattern
        ]
        
        try:
            subprocess.run(cmd, capture_output=True, check=True)
            
            # 抽出されたフレームのリストを取得
            frames = sorted(output_dir.glob("frame_*.jpg"))
            return [str(f) for f in frames]
            
        except subprocess.CalledProcessError as e:
            print(f"Error extracting frames: {e}")
            return []
    
    def calculate_timestamp(
        self, 
        frame_number: int, 
        fps: float,
        start_time: Optional[datetime] = None
    ) -> datetime:
        """
        フレーム番号からタイムスタンプを計算
        
        Args:
            frame_number: フレーム番号
            fps: 動画のFPS
            start_time: 動画の開始時刻
            
        Returns:
            datetime: タイムスタンプ
        """
        if start_time is None:
            start_time = datetime.now()
        
        seconds = frame_number / fps if fps > 0 else 0
        return start_time + timedelta(seconds=seconds)
    
    def save_processed_frame(
        self,
        image: Image.Image,
        upload_id: int,
        frame_number: int
    ) -> str:
        """
        処理済みフレームを保存
        
        Args:
            image: PIL Image
            upload_id: アップロードID
            frame_number: フレーム番号
            
        Returns:
            str: 保存パス
        """
        output_dir = self.storage_path / "processed" / str(upload_id)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filename = f"detected_{frame_number:06d}.jpg"
        output_path = output_dir / filename
        
        image.save(output_path, "JPEG", quality=90)
        
        return str(output_path)

    def list_frame_files(self, frames_dir: str) -> List[Path]:
        """
        画像フレームのファイル一覧を取得

        Args:
            frames_dir: フレームが格納されたディレクトリ

        Returns:
            List[Path]: 画像ファイルのパス一覧（名前順）
        """
        directory = Path(frames_dir)
        if not directory.exists():
            return []

        allowed = {".jpg", ".jpeg", ".png"}
        files = [p for p in directory.rglob("*") if p.is_file() and p.suffix.lower() in allowed]
        return sorted(files, key=lambda p: str(p))


# ファクトリ関数
def get_video_processor(frame_interval: int = None) -> VideoProcessor:
    """VideoProcessorインスタンスを取得"""
    return VideoProcessor(frame_interval=frame_interval)
