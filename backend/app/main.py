"""
Bear Detection System - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import initialize_firebase
from app.api import cameras, uploads, sightings, alerts, images

# Firebase Admin SDK初期化
initialize_firebase()

app = FastAPI(
    title="Bear Detection API",
    description="監視カメラ映像から熊を検出し、地図上にマッピングするAPIシステム",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """
    ルートエンドポイント
    """
    return {
        "message": "Bear Detection API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """
    ヘルスチェック
    """
    return {"status": "healthy"}


# APIルーター登録
app.include_router(cameras.router, prefix=settings.API_V1_PREFIX)
app.include_router(uploads.router, prefix=settings.API_V1_PREFIX)
app.include_router(sightings.router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)
app.include_router(images.router, prefix=settings.API_V1_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
