"""
Cloud Storage Service
ローカルストレージとGoogle Cloud Storageの両方に対応
"""
import os
from pathlib import Path
from typing import Optional
from google.cloud import storage
from app.core.config import settings


class StorageService:
    """ストレージサービス（ローカル or GCS）"""
    
    def __init__(self):
        self.storage_type = settings.STORAGE_TYPE
        
        if self.storage_type == "gcs":
            try:
                self.gcs_client = storage.Client()
                self.bucket_name = settings.GCS_BUCKET_NAME
                self.bucket = self.gcs_client.bucket(self.bucket_name)
                print(f"✅ GCS initialized: {self.bucket_name}")
            except Exception as e:
                print(f"⚠️ GCS initialization failed: {e}")
                print("Falling back to local storage")
                self.storage_type = "local"
        
        if self.storage_type == "local":
            self.local_path = Path(settings.LOCAL_STORAGE_PATH)
            self.local_path.mkdir(parents=True, exist_ok=True)
            print(f"✅ Local storage initialized: {self.local_path}")
    
    def save_file(self, file_content: bytes, destination_path: str) -> str:
        """
        ファイルを保存
        
        Args:
            file_content: ファイルの内容（バイナリ）
            destination_path: 保存先パス（例: "uploads/video.mp4"）
            
        Returns:
            str: 保存されたファイルのパスまたはURL
        """
        if self.storage_type == "gcs":
            return self._save_to_gcs(file_content, destination_path)
        else:
            return self._save_to_local(file_content, destination_path)
    
    def _save_to_gcs(self, file_content: bytes, destination_path: str) -> str:
        """GCSにファイルを保存"""
        blob = self.bucket.blob(destination_path)
        blob.upload_from_string(file_content)
        
        # 公開URLを返す
        return f"https://storage.googleapis.com/{self.bucket_name}/{destination_path}"
    
    def _save_to_local(self, file_content: bytes, destination_path: str) -> str:
        """ローカルにファイルを保存"""
        full_path = self.local_path / destination_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(full_path, "wb") as f:
            f.write(file_content)
        
        return str(full_path)
    
    def get_file_url(self, file_path: str) -> str:
        """
        ファイルのURLを取得
        
        Args:
            file_path: ファイルパス
            
        Returns:
            str: ファイルのURL
        """
        if self.storage_type == "gcs":
            # GCSの場合は公開URL
            if file_path.startswith("https://"):
                return file_path
            return f"https://storage.googleapis.com/{self.bucket_name}/{file_path}"
        else:
            # ローカルの場合はAPIエンドポイント経由
            relative_path = file_path.replace(str(self.local_path), "").lstrip("/")
            return f"/api/v1/images/{relative_path}"
    
    def delete_file(self, file_path: str) -> bool:
        """
        ファイルを削除
        
        Args:
            file_path: ファイルパス
            
        Returns:
            bool: 削除成功したか
        """
        try:
            if self.storage_type == "gcs":
                blob = self.bucket.blob(file_path)
                blob.delete()
            else:
                full_path = self.local_path / file_path
                if full_path.exists():
                    full_path.unlink()
            return True
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
            return False
    
    def file_exists(self, file_path: str) -> bool:
        """
        ファイルの存在確認
        
        Args:
            file_path: ファイルパス
            
        Returns:
            bool: ファイルが存在するか
        """
        if self.storage_type == "gcs":
            blob = self.bucket.blob(file_path)
            return blob.exists()
        else:
            full_path = self.local_path / file_path
            return full_path.exists()


# シングルトンインスタンス
_storage_service: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """ストレージサービスのシングルトンを取得"""
    global _storage_service
    if _storage_service is None:
        _storage_service = StorageService()
    return _storage_service
