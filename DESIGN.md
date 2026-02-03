# 熊検出・警報システム (Bear Detection Alert System)

監視カメラの映像から熊を自動検出し、地図上に出没地点をマッピングするシステム

---

## 📋 目次

1. [システム概要](#1-システム概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [データベース設計](#3-データベース設計)
4. [API設計](#4-api設計)
5. [フロントエンド設計](#5-フロントエンド設計)
6. [AI検出モデル](#6-ai検出モデル)
7. [セットアップ手順](#7-セットアップ手順)

---

## 1. システム概要

### 1.1 目的

- 監視カメラ映像から熊を自動検出
- 検出地点を地図上にリアルタイム表示
- 住民・関係者への警報通知
- 出没履歴の蓄積と分析

### 1.2 主な機能

| 機能 | 説明 |
|------|------|
| 映像アップロード | 監視カメラ映像（動画/静止画）と位置情報を登録 |
| 熊検出 | YOLOモデルによる熊の自動検出 |
| 地図表示 | 検出地点を地図上にマーカー表示 |
| 警報レベル分類 | 検出信頼度・頭数に基づく危険度判定 |
| 履歴管理 | 過去の出没記録の検索・分析 |

### 1.3 技術スタック

```
Backend:   FastAPI (Python 3.11+)
Database:  PostgreSQL 15 + PostGIS
Queue:     Redis + Celery
Frontend:  Next.js 15 (App Router) + TypeScript
Map:       React Leaflet
AI:        YOLOv8 (カスタム熊検出モデル)
Container: Docker + Docker Compose
```

---

## 2. アーキテクチャ

### 2.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Upload Panel │  │   Map View   │  │  Alert Dashboard     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (FastAPI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ /api/cameras │  │ /api/sightings│  │ /api/alerts         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   Storage    │    │  PostgreSQL      │    │    Redis     │
│  (Videos/    │    │  + PostGIS       │    │   (Queue)    │
│   Images)    │    │                  │    │              │
└──────────────┘    └──────────────────┘    └──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Celery Worker   │
                    │  (YOLO Detection)│
                    └──────────────────┘
```

### 2.2 プロジェクト構造

```
bear-detection-system/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py           # 設定管理
│   │   │   └── database.py         # DB接続
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── camera.py           # 監視カメラモデル
│   │   │   ├── sighting.py         # 熊目撃モデル
│   │   │   ├── detection.py        # 検出結果モデル
│   │   │   └── schemas.py          # Pydanticスキーマ
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── cameras.py          # カメラ管理API
│   │   │   ├── sightings.py        # 目撃情報API
│   │   │   ├── uploads.py          # アップロードAPI
│   │   │   └── alerts.py           # 警報API
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── detection.py        # YOLO検出サービス
│   │       ├── video_processor.py  # 動画処理
│   │       └── alert_service.py    # 警報サービス
│   ├── migrations/
│   │   └── 001_init_schema.sql
│   ├── models/
│   │   └── bear_detector.pt        # YOLOモデル
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # メインページ
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── shared/
│   │   │   ├── api/                # API通信
│   │   │   ├── types/              # 型定義
│   │   │   ├── lib/                # ユーティリティ
│   │   │   └── ui/                 # 共通UIコンポーネント
│   │   ├── entities/
│   │   │   ├── camera/             # カメラエンティティ
│   │   │   └── sighting/           # 目撃エンティティ
│   │   ├── features/
│   │   │   └── upload-footage/     # 映像アップロード機能
│   │   └── widgets/
│   │       ├── map/                # 地図ウィジェット
│   │       └── alert-panel/        # 警報パネル
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 3. データベース設計

### 3.1 ER図

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    cameras      │     │    uploads      │     │   sightings     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │────<│ id (PK)         │────<│ id (PK)         │
│ name            │     │ camera_id (FK)  │     │ upload_id (FK)  │
│ location (POINT)│     │ file_path       │     │ location (POINT)│
│ latitude        │     │ file_type       │     │ detected_at     │
│ longitude       │     │ uploaded_at     │     │ confidence      │
│ description     │     │ processed_at    │     │ bear_count      │
│ is_active       │     │ status          │     │ alert_level     │
│ created_at      │     │ frame_count     │     │ image_path      │
└─────────────────┘     └─────────────────┘     │ created_at      │
                                                 └─────────────────┘
                                                         │
                                                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │     alerts      │     │   detections    │
                        ├─────────────────┤     ├─────────────────┤
                        │ id (PK)         │     │ id (PK)         │
                        │ sighting_id (FK)│<────│ sighting_id (FK)│
                        │ alert_level     │     │ class_name      │
                        │ message         │     │ confidence      │
                        │ notified_at     │     │ bbox_x          │
                        │ acknowledged    │     │ bbox_y          │
                        └─────────────────┘     │ bbox_w          │
                                                │ bbox_h          │
                                                └─────────────────┘
```

### 3.2 テーブル定義

#### cameras（監視カメラ）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | SERIAL | PK | カメラID |
| name | VARCHAR(255) | NOT NULL | カメラ名 |
| location | GEOMETRY(Point, 4326) | | 設置位置（PostGIS） |
| latitude | DECIMAL(10, 8) | NOT NULL | 緯度 |
| longitude | DECIMAL(11, 8) | NOT NULL | 経度 |
| description | TEXT | | 説明（設置場所等） |
| is_active | BOOLEAN | DEFAULT true | 稼働状態 |
| created_at | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| updated_at | TIMESTAMP | | 更新日時 |

#### uploads（アップロード映像）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | SERIAL | PK | アップロードID |
| camera_id | INTEGER | FK → cameras | カメラID |
| file_path | VARCHAR(500) | NOT NULL | ファイルパス |
| file_type | VARCHAR(20) | NOT NULL | 'video' / 'image' |
| file_size | BIGINT | | ファイルサイズ（バイト） |
| duration_seconds | INTEGER | | 動画の長さ |
| uploaded_at | TIMESTAMP | DEFAULT NOW() | アップロード日時 |
| recorded_at | TIMESTAMP | | 撮影日時 |
| processed_at | TIMESTAMP | | 処理完了日時 |
| status | VARCHAR(20) | DEFAULT 'pending' | 処理状態 |
| frame_count | INTEGER | | 抽出フレーム数 |
| error_message | TEXT | | エラーメッセージ |

#### sightings（熊目撃記録）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | SERIAL | PK | 目撃ID |
| upload_id | INTEGER | FK → uploads | アップロードID |
| location | GEOMETRY(Point, 4326) | NOT NULL | 目撃位置 |
| latitude | DECIMAL(10, 8) | NOT NULL | 緯度 |
| longitude | DECIMAL(11, 8) | NOT NULL | 経度 |
| detected_at | TIMESTAMP | NOT NULL | 検出日時 |
| confidence | DECIMAL(5, 4) | NOT NULL | 最大信頼度 (0-1) |
| bear_count | INTEGER | DEFAULT 1 | 検出頭数 |
| alert_level | VARCHAR(20) | NOT NULL | 警報レベル |
| image_path | VARCHAR(500) | | 検出画像パス |
| frame_number | INTEGER | | フレーム番号 |
| created_at | TIMESTAMP | DEFAULT NOW() | 登録日時 |

#### detections（検出詳細）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | SERIAL | PK | 検出ID |
| sighting_id | INTEGER | FK → sightings | 目撃ID |
| class_name | VARCHAR(50) | NOT NULL | 検出クラス（bear等） |
| confidence | DECIMAL(5, 4) | NOT NULL | 信頼度 |
| bbox_x | INTEGER | NOT NULL | バウンディングボックスX |
| bbox_y | INTEGER | NOT NULL | バウンディングボックスY |
| bbox_w | INTEGER | NOT NULL | バウンディングボックス幅 |
| bbox_h | INTEGER | NOT NULL | バウンディングボックス高さ |

#### alerts（警報）

| カラム名 | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | SERIAL | PK | 警報ID |
| sighting_id | INTEGER | FK → sightings | 目撃ID |
| alert_level | VARCHAR(20) | NOT NULL | 警報レベル |
| message | TEXT | NOT NULL | 警報メッセージ |
| notified_at | TIMESTAMP | DEFAULT NOW() | 通知日時 |
| acknowledged | BOOLEAN | DEFAULT false | 確認済みフラグ |
| acknowledged_at | TIMESTAMP | | 確認日時 |
| acknowledged_by | VARCHAR(100) | | 確認者 |

### 3.3 警報レベル定義

| レベル | 値 | 条件 | 色 |
|--------|-----|------|-----|
| 危険 | critical | 信頼度 >= 0.9 または 複数頭検出 | 🔴 赤 |
| 警戒 | warning | 信頼度 >= 0.7 | 🟠 オレンジ |
| 注意 | caution | 信頼度 >= 0.5 | 🟡 黄色 |
| 低 | low | 信頼度 < 0.5 | 🔵 青 |

※ フロントエンドUIでは「低 (low)」は表示対象から除外しています（現在地マーカーとの視認性を優先）。

### 3.4 SQLマイグレーション

```sql
-- migrations/001_init_schema.sql

-- PostGIS拡張の有効化
CREATE EXTENSION IF NOT EXISTS postgis;

-- カメラテーブル
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- アップロードテーブル
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('video', 'image')),
    file_size BIGINT,
    duration_seconds INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_at TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    frame_count INTEGER,
    error_message TEXT
);

-- 目撃記録テーブル
CREATE TABLE sightings (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    bear_count INTEGER DEFAULT 1,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'warning', 'caution', 'low')),
    image_path VARCHAR(500),
    frame_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 検出詳細テーブル
CREATE TABLE detections (
    id SERIAL PRIMARY KEY,
    sighting_id INTEGER REFERENCES sightings(id) ON DELETE CASCADE,
    class_name VARCHAR(50) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    bbox_x INTEGER NOT NULL,
    bbox_y INTEGER NOT NULL,
    bbox_w INTEGER NOT NULL,
    bbox_h INTEGER NOT NULL
);

-- 警報テーブル
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    sighting_id INTEGER REFERENCES sightings(id) ON DELETE CASCADE,
    alert_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100)
);

-- インデックス
CREATE INDEX idx_cameras_location ON cameras USING GIST (location);
CREATE INDEX idx_sightings_location ON sightings USING GIST (location);
CREATE INDEX idx_sightings_detected_at ON sightings (detected_at DESC);
CREATE INDEX idx_sightings_alert_level ON sightings (alert_level);
CREATE INDEX idx_uploads_status ON uploads (status);
CREATE INDEX idx_alerts_acknowledged ON alerts (acknowledged);
```

---

## 4. API設計

### 4.1 エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| POST | /api/v1/cameras | カメラ登録 |
| GET | /api/v1/cameras | カメラ一覧取得 |
| GET | /api/v1/cameras/{id} | カメラ詳細取得 |
| PUT | /api/v1/cameras/{id} | カメラ更新 |
| DELETE | /api/v1/cameras/{id} | カメラ削除 |
| POST | /api/v1/uploads | 映像アップロード |
| GET | /api/v1/uploads/{id} | アップロード状態取得 |
| GET | /api/v1/sightings | 目撃一覧取得 |
| GET | /api/v1/sightings/{id} | 目撃詳細取得 |
| GET | /api/v1/alerts | 警報一覧取得 |
| PUT | /api/v1/alerts/{id}/acknowledge | 警報確認 |
| GET | /api/v1/images/{path} | 画像取得 |

### 4.2 詳細仕様

#### POST /api/v1/uploads

映像（動画または画像）をアップロードし、熊検出処理を開始。

**リクエスト（multipart/form-data）:**

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| file | File | ✓ | 動画/画像ファイル |
| camera_id | integer | | 登録済みカメラID |
| latitude | number | ✓* | 緯度（camera_id未指定時必須） |
| longitude | number | ✓* | 経度（camera_id未指定時必須） |
| recorded_at | string | | 撮影日時（ISO8601） |
| frame_interval | integer | | フレーム抽出間隔（秒、デフォルト: 5） |

**レスポンス:**

```json
{
  "upload_id": 123,
  "status": "processing",
  "message": "映像の処理を開始しました",
  "estimated_time_seconds": 60
}
```

#### GET /api/v1/sightings

熊目撃情報を取得（地図表示用）。

**クエリパラメータ:**

| パラメータ | 型 | デフォルト | 説明 |
|------------|-----|------------|------|
| start_date | string | | 開始日時（ISO8601） |
| end_date | string | | 終了日時（ISO8601） |
| alert_level | string | | 警報レベルでフィルタ |
| min_confidence | number | | 最小信頼度 |
| camera_id | integer | | カメラIDでフィルタ |
| bounds | string | | 地図範囲（sw_lat,sw_lng,ne_lat,ne_lng） |
| limit | integer | 100 | 取得件数 |
| offset | integer | 0 | オフセット |

**レスポンス:**

```json
{
  "total": 150,
  "sightings": [
    {
      "id": 1,
      "latitude": 35.6812,
      "longitude": 139.7671,
      "detected_at": "2025-12-25T10:30:00Z",
      "confidence": 0.95,
      "bear_count": 1,
      "alert_level": "critical",
      "image_url": "/api/v1/images/sightings/1/detected.jpg",
      "camera": {
        "id": 5,
        "name": "山間部カメラA"
      }
    }
  ]
}
```

#### GET /api/v1/alerts

未確認の警報一覧を取得。

**レスポンス:**

```json
{
  "total": 5,
  "alerts": [
    {
      "id": 10,
      "sighting_id": 1,
      "alert_level": "critical",
      "message": "🐻 熊を検出しました！山間部カメラA付近で高い信頼度(95%)で熊が確認されました。",
      "notified_at": "2025-12-25T10:30:05Z",
      "acknowledged": false,
      "sighting": {
        "latitude": 35.6812,
        "longitude": 139.7671,
        "bear_count": 1,
        "image_url": "/api/v1/images/sightings/1/detected.jpg"
      }
    }
  ]
}
```

---

## 5. フロントエンド設計

### 5.1 画面構成

```
┌─────────────────────────────────────────────────────────────────┐
│  🐻 熊検出警報システム                              [警報: 3件] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────┐ ┌──────────────────────────┐ │
│  │                              │ │  📹 映像アップロード     │ │
│  │                              │ ├──────────────────────────┤ │
│  │                              │ │  ┌────────────────────┐  │ │
│  │         地図表示             │ │  │  ドラッグ&ドロップ │  │ │
│  │                              │ │  │  または クリック   │  │ │
│  │    🔴 危険                   │ │  └────────────────────┘  │ │
│  │    🟠 警戒                   │ │  カメラ: [選択 ▼]       │ │
│  │    🟡 注意                   │ │  または位置を入力:      │ │
│  │                              │ │  緯度: [          ]     │ │
│  │                              │ │  経度: [          ]     │ │
│  │                              │ │  [アップロード開始]     │ │
│  └──────────────────────────────┘ └──────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📋 最近の目撃情報                          [全件表示 →] │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  🔴 12/25 10:30  山間部カメラA  信頼度95%  1頭  [詳細]   │  │
│  │  🟠 12/25 09:15  林道カメラB    信頼度78%  1頭  [詳細]   │  │
│  │  🟡 12/24 18:45  農地カメラC    信頼度55%  1頭  [詳細]   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 コンポーネント構成

```
src/
├── app/
│   └── page.tsx                    # メインページ
├── shared/
│   ├── api/
│   │   └── index.ts                # API通信関数
│   ├── types/
│   │   └── index.ts                # 型定義
│   ├── lib/
│   │   ├── config.ts               # 設定
│   │   └── utils.ts                # ユーティリティ
│   └── ui/
│       ├── ImageModal.tsx          # 画像モーダル
│       └── LoadingSpinner.tsx      # ローディング
├── features/
│   └── upload-footage/
│       └── ui/
│           └── UploadPanel.tsx     # アップロードパネル
└── widgets/
    ├── map/
    │   ├── ui/
    │   │   └── MapView.tsx         # 地図コンポーネント
    │   └── lib/
    │       └── utils.ts            # 地図ユーティリティ
    ├── alert-panel/
    │   └── ui/
    │       └── AlertPanel.tsx      # 警報パネル
    └── sighting-list/
        └── ui/
            └── SightingList.tsx    # 目撃リスト
```

### 5.3 型定義

```typescript
// shared/types/index.ts

export interface Camera {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  is_active: boolean;
}

export interface Sighting {
  id: number;
  latitude: number;
  longitude: number;
  detected_at: string;
  confidence: number;
  bear_count: number;
  alert_level: AlertLevel;
  image_url?: string;
  camera?: Camera;
}

export interface Detection {
  id: number;
  class_name: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Alert {
  id: number;
  sighting_id: number;
  alert_level: AlertLevel;
  message: string;
  notified_at: string;
  acknowledged: boolean;
  sighting: Sighting;
}

export type AlertLevel = 'critical' | 'warning' | 'caution' | 'low';

export interface UploadResponse {
  upload_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
}

export const alertLevelColors: Record<AlertLevel, string> = {
  critical: '#dc2626', // red-600
  warning: '#ea580c',  // orange-600
  caution: '#ca8a04',  // yellow-600
  low: '#2563eb',      // blue-600
};

export const alertLevelLabels: Record<AlertLevel, string> = {
  critical: '危険',
  warning: '警戒',
  caution: '注意',
  low: '低',
};
```

### 5.4 地図マーカーの色分け

```typescript
// widgets/map/lib/utils.ts

export const getAlertColor = (alertLevel: AlertLevel): string => {
  const colors = {
    critical: '#dc2626',  // 赤
    warning: '#ea580c',   // オレンジ
    caution: '#ca8a04',   // 黄色
    low: '#2563eb',       // 青
  };
  return colors[alertLevel] || '#6b7280';
};

export const getMarkerRadius = (bearCount: number): number => {
  // 検出頭数に応じてマーカーサイズを変更
  return Math.min(8 + bearCount * 4, 20);
};
```

---

## 6. AI検出モデル

### 6.1 モデル仕様

| 項目 | 値 |
|------|-----|
| ベースモデル | YOLOv8 |
| 検出クラス | bear（熊） |
| 入力サイズ | 640x640 |
| 推論形式 | ONNX または PyTorch (.pt) |

### 6.2 検出サービス

```python
# backend/app/services/detection.py

from ultralytics import YOLO
from PIL import Image
import numpy as np
from typing import List, Dict
from app.core.config import settings

class BearDetectionService:
    def __init__(self):
        self.model = YOLO(settings.MODEL_PATH)
        self.confidence_threshold = settings.DETECTION_CONFIDENCE_THRESHOLD
    
    def detect(self, image: Image.Image) -> List[Dict]:
        """
        画像から熊を検出
        
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
        results = self.model(image, conf=self.confidence_threshold)
        
        detections = []
        for result in results:
            for box in result.boxes:
                if result.names[int(box.cls)] == 'bear':
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
    
    def calculate_alert_level(self, detections: List[Dict]) -> str:
        """検出結果から警報レベルを判定"""
        if not detections:
            return None
        
        max_confidence = max(d["confidence"] for d in detections)
        bear_count = len(detections)
        
        if max_confidence >= 0.9 or bear_count >= 2:
            return "critical"
        elif max_confidence >= 0.7:
            return "warning"
        elif max_confidence >= 0.5:
            return "caution"
        else:
            return "low"
```

### 6.3 動画処理サービス

```python
# backend/app/services/video_processor.py

import cv2
from pathlib import Path
from typing import Generator, Tuple
from PIL import Image

class VideoProcessor:
    def __init__(self, frame_interval: int = 5):
        self.frame_interval = frame_interval  # 秒単位
    
    def extract_frames(self, video_path: str) -> Generator[Tuple[int, Image.Image], None, None]:
        """
        動画からフレームを抽出
        
        Yields:
            Tuple[int, Image.Image]: (フレーム番号, PIL Image)
        """
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_skip = int(fps * self.frame_interval)
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_count % frame_skip == 0:
                # BGR → RGB変換
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                yield frame_count, pil_image
            
            frame_count += 1
        
        cap.release()
```

---

## 7. セットアップ手順

### 7.1 必要要件

- Docker & Docker Compose
- Node.js 18+ (フロントエンド開発時)
- Python 3.11+ (バックエンド開発時)

### 7.2 クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-org/bear-detection-system.git
cd bear-detection-system

# 2. 環境変数ファイルを作成
cp backend/.env.example backend/.env

# 3. Docker Composeで起動
docker compose up -d

# 4. サービス確認
# - API ドキュメント: http://localhost:8000/docs
# - フロントエンド: http://localhost:3000
```

### 7.3 Docker Compose設定

```yaml
# docker-compose.yml

version: '3.8'

services:
  db:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_USER: bearuser
      POSTGRES_PASSWORD: bearpass
      POSTGRES_DB: bear_detection_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://bearuser:bearpass@db:5432/bear_detection_db
      REDIS_URL: redis://redis:6379/0
      MODEL_PATH: /app/models/bear_detector.pt
      DETECTION_CONFIDENCE_THRESHOLD: 0.5
    volumes:
      - ./backend:/app
      - storage_data:/app/storage
    depends_on:
      - db
      - redis

  celery:
    build: ./backend
    command: celery -A app.celery_worker worker --loglevel=info
    environment:
      DATABASE_URL: postgresql://bearuser:bearpass@db:5432/bear_detection_db
      REDIS_URL: redis://redis:6379/0
      MODEL_PATH: /app/models/bear_detector.pt
    volumes:
      - ./backend:/app
      - storage_data:/app/storage
    depends_on:
      - db
      - redis
      - backend

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000/api/v1
    depends_on:
      - backend

volumes:
  postgres_data:
  storage_data:
```

### 7.4 環境変数

```bash
# backend/.env.example

# Database
DATABASE_URL=postgresql://bearuser:bearpass@localhost:5432/bear_detection_db
DB_POOL_SIZE=20

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# Storage
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/app/storage

# Detection Model
MODEL_PATH=/app/models/bear_detector.pt
DETECTION_CONFIDENCE_THRESHOLD=0.5
DEFAULT_FRAME_INTERVAL_SECONDS=5

# CORS
CORS_ORIGINS=http://localhost:3000

# Application
DEBUG=true
API_V1_PREFIX=/api/v1
```

---

## 📝 道路損傷検出システムからの変更点まとめ

| 項目 | 道路損傷検出 | 熊検出システム |
|------|--------------|----------------|
| 検出対象 | 道路損傷 (D00-D50) | 熊 (bear) |
| 入力 | 車載カメラ動画 + GPS CSV | 監視カメラ映像 + 固定位置 |
| 位置情報 | フレームごとにGPS対応 | カメラの固定位置 |
| 出力 | 損傷スコア (0-5) | 警報レベル (4段階) |
| 地図マーカー | 損傷種別で色分け | 警報レベルで色分け |
| 主要テーブル | images, danger_spots | uploads, sightings |
| 追加機能 | AHPスコア計算 | 警報通知、確認機能 |

---

## 📚 参考資料

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostGIS Documentation](https://postgis.net/)
- [YOLOv8 Documentation](https://docs.ultralytics.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Leaflet](https://react-leaflet.js.org/)
