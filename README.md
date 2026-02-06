# 🐻 Bear Detection System

監視カメラの映像から熊を自動検出し、地図上に出没地点をマッピングするシステム

## 🌐 デプロイ情報

### 本番環境（予定）

| コンポーネント | サービス | URL | ステータス |
|--------------|---------|-----|-----------|
| フロントエンド | Firebase App Hosting | `https://kuma-eye.web.app` | 🚧 準備中 |
| バックエンドAPI | Google Cloud Run | TBD | 🚧 準備中 |
| データベース | Supabase (PostgreSQL + PostGIS) | `aws-1-ap-northeast-1.pooler.supabase.com` | ✅ 稼働中 |
| 認証 | Firebase Authentication | Firebase Project: `kuma-eye` | ✅ 設定済み |
| ストレージ | Cloud Storage (GCS) | `kuma-eye.firebasestorage.app` | ✅ 設定済み |

### ローカル開発環境

| コンポーネント | 技術スタック | ポート |
|--------------|-------------|--------|
| フロントエンド | Next.js 15.0.0 + React 18 + TypeScript | 3000 |
| バックエンドAPI | FastAPI + Python 3.13 | 8000 |
| データベース | Supabase (リモート接続) | - |
| 認証 | Firebase Auth (Google + Email/Password) | - |
| ファイルストレージ | ローカル (`./backend/storage`) | - |

### デプロイ手順

本番環境へのデプロイ方法は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

---

## 🚀 クイックスタート

### 方法1: Makefileを使用（推奨）

```bash
# 依存関係のセットアップ（初回）
make setup

# ローカル開発環境を起動（Docker不要）
make dev

# 停止
make stop
```

### 方法2: 手動起動（Docker不要）

**ターミナル1 - バックエンド:**
```bash
cd backend
source venv/bin/activate  # 初回: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**ターミナル2 - フロントエンド:**
```bash
cd frontend
npm install  # 初回のみ
npm run dev
```

**アクセス:**
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 方法3: スクリプトを使用

```bash
# 起動
./start-local.sh

# 停止
./stop-local.sh
```

### 方法4: Docker Composeを使用

```bash
# Docker環境で起動
make dev-docker

# または直接
docker compose up -d

# サンプルデータを投入
make seed
```

これで以下のサービスが起動します:
- **PostgreSQL** (PostGIS対応) - ポート5432
- **Redis** - ポート6379
- **Backend API** (FastAPI) - ポート8000
- **Celery Worker** (熊検出ワーカー)
- **Frontend** (Next.js) - ポート3000

### 🌐 アクセスURL

| サービス | URL |
|----------|-----|
| フロントエンド | http://localhost:3000 |
| API ドキュメント | http://localhost:8000/docs |
| API エンドポイント | http://localhost:8000/api/v1 |
| ヘルスチェック | http://localhost:8000/health |

## 📁 プロジェクト構成

```
.
├── backend/              # FastAPI バックエンド
│   ├── app/
│   │   ├── api/         # APIエンドポイント
│   │   ├── models/      # データモデル
│   │   ├── services/    # ビジネスロジック
│   │   ├── celery_worker.py  # Celery非同期ワーカー
│   │   └── core/        # 設定、DB接続
│   ├── migrations/      # SQLマイグレーション
│   ├── models/          # YOLOモデル
│   └── Dockerfile
├── frontend/            # Next.js フロントエンド
│   └── src/
│       ├── app/         # ページコンポーネント
│       ├── features/    # 機能コンポーネント
│       ├── widgets/     # UIウィジェット
│       └── shared/      # 共通コンポーネント・API
├── scripts/             # 便利スクリプト
├── docker-compose.yml   # Docker Compose設定
├── Makefile            # Make コマンド
├── DESIGN.md           # 設計書
└── README.md
```

## 🧰 便利なコマンド (Makefile)

```bash
# ローカル開発（Docker不要）
make setup        # 依存関係をセットアップ
make dev          # ローカル開発環境を起動
make stop         # ローカル開発環境を停止

# Docker開発
make dev-docker   # Docker開発環境を起動
make stop-docker  # Docker開発環境を停止
make clean        # 停止＋データ削除
make build        # イメージを再ビルド

# ログ・管理
make logs         # 全ログを表示
make backend      # バックエンドログのみ表示
make frontend     # フロントエンドログのみ表示
make status       # サービス状態確認

# データベース
make db           # PostgreSQLに接続
make seed         # サンプルデータを投入
```

## 🎯 主な機能

### 🔐 認証機能
- **Firebase Authentication**: Googleアカウント + メールアドレス/パスワードでログイン・新規登録
- **JWT トークン認証**: APIアクセスの保護

### 📹 映像アップロード・熊検出
- **POST /api/v1/uploads** - 映像アップロードと熊検出
  - 動画・画像ファイルのアップロード
  - YOLOv8による自動熊検出
  - 検出結果の可視化

### 🗺️ 地図表示・目撃情報
- **GET /api/v1/sightings** - 目撃情報一覧
  - 地図上にマーカー表示
  - 信頼度に応じた色分け
  - 検出画像のプレビュー

### 🚨 警報管理
- **GET /api/v1/alerts** - 警報一覧
  - リアルタイム警報表示
  - 警報レベルによる優先度表示

### 📷 カメラ管理
- **GET /api/v1/cameras** - カメラ一覧
  - 監視カメラの位置情報
  - アクティブ状態管理

## 🐻 検出可能

- 熊（bear）- YOLOv8による検出

## 📊 警報レベル

| レベル | 条件 | 色 |
|--------|------|-----|
| 🔴 critical | 信頼度 >= 90% または 複数頭 | 赤 |
| 🟠 warning | 信頼度 >= 70% | オレンジ |
| 🟡 caution | 信頼度 >= 50% | 黄色 |
| 🔵 low | 信頼度 < 50% | 青 |

※ UI表示では「低 (low)」は非表示としています（現在地マーカーとの視認性確保のため）。

## 📖 ドキュメント

- [設計書](./DESIGN.md) - 完全なAPI仕様とDB設計
- [デプロイガイド](./DEPLOYMENT.md) - 本番環境へのデプロイ手順

## 🔧 技術スタック

### フロントエンド
- **Next.js 15.0.0** - Reactフレームワーク
- **React 18.3.1** - UIライブラリ
- **TypeScript** - 型安全性
- **Leaflet / React Leaflet** - 地図表示
- **Axios** - HTTP クライアント
- **Firebase SDK** - 認証

### バックエンド
- **FastAPI** - Pythonウェブフレームワーク
- **Python 3.13** - プログラミング言語
- **SQLAlchemy** - ORM
- **Psycopg2** - PostgreSQLドライバー
- **Uvicorn** - ASGIサーバー
- **YOLOv8 (ultralytics)** - 物体検出モデル
- **OpenCV** - 画像・動画処理
- **Firebase Admin SDK** - サーバーサイド認証

### データベース・インフラ
- **Supabase (PostgreSQL 15 + PostGIS)** - 位置情報対応データベース
- **Firebase Authentication** - ユーザー認証
- **Cloud Storage (GCS)** - ファイルストレージ
- **Google Cloud Run** - コンテナデプロイ（予定）
- **Firebase App Hosting** - フロントエンドホスティング（予定）

### GitHubリポジトリ
- https://github.com/sabe-0524/KUMA-EYE

## 🛠️ トラブルシューティング

### Docker Desktopが動かない・エラーが出る

Docker Desktopが「Engine running」と表示されているのに `docker ps` が動かない、または頻繁にエラーが発生する場合は以下の手順で修復できます：

```bash
# 1. Docker Desktopを強制終了
killall "Docker Desktop" 2>/dev/null
killall "Docker" 2>/dev/null

# 2. 問題のあるデータを削除（コンテナデータは保持されます）
rm -rf ~/Library/Containers/com.docker.docker/Data/vms
rm -f ~/.docker/run/docker.sock

# 3. Docker Desktopを再起動
open -a "Docker Desktop"

# 4. 2分ほど待ってから確認
docker ps
```

**ワンライナー版（コピペ用）:**
```bash
killall "Docker Desktop" 2>/dev/null; killall "Docker" 2>/dev/null; sleep 2 && rm -rf ~/Library/Containers/com.docker.docker/Data/vms 2>/dev/null && rm -f ~/.docker/run/docker.sock 2>/dev/null && open -a "Docker Desktop" && echo "Docker再起動中...2分待ってください"
```

復旧後、DB/Redisを起動：
```bash
docker compose up -d db redis
make dev
```

> **💡 ヒント**: Docker Desktopの通知に「更新があります」と表示されている場合は、更新をインストールすると安定することがあります。

### データベース初期化

```bash
# データベースを再作成（データ削除）
make clean
make dev
```

または

```bash
docker compose down -v
docker compose up -d
```

### ログ確認

```bash
# 全ログ
make logs

# バックエンドのみ
make backend

# 特定サービス
docker compose logs -f backend celery
```

### ポートが使用中

```bash
# 使用中のポートを確認
lsof -i :8000
lsof -i :3000

# 必要に応じてプロセスを終了
kill -9 <PID>
```

### フロントエンドが表示されない

```bash
# フロントエンドを再起動
docker compose restart frontend
```

## 🧪 デモ用クマ検出

YOLOモデルが未設定の場合、システムはモックモードで動作します。
実際の熊検出を有効にするには：

1. YOLOv8の熊検出モデル（.pt形式）を `backend/models/bear_detector.pt` に配置
2. `docker compose restart celery backend` でサービスを再起動

## 📝 ライセンス

MIT License
# KUMA-EYE
