# 🐻 Bear Detection System

監視カメラの映像から熊を自動検出し、地図上に出没地点をマッピングするシステム

## 🚀 クイックスタート

### 方法1: Makefileを使用（推奨）

```bash
# 開発環境を起動
make dev

# サンプルデータを投入
make seed
```

### 方法2: スクリプトを使用

```bash
# 開発環境を起動
./scripts/start-dev.sh

# サンプルデータを投入
./scripts/seed_data.sh
```

### 方法3: Docker Composeを直接使用

```bash
# リポジトリルートで実行
docker compose up -d
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
make dev      # 開発環境を起動
make stop     # 開発環境を停止
make clean    # 停止＋データ削除
make logs     # 全ログを表示
make seed     # サンプルデータを投入
make build    # イメージを再ビルド
make backend  # バックエンドログのみ表示
make frontend # フロントエンドログのみ表示
make db       # PostgreSQLに接続
make status   # サービス状態確認
```

## 🎯 主な機能

- **POST /api/v1/uploads** - 映像アップロードと熊検出
- **GET /api/v1/sightings** - 目撃情報一覧（地図表示用）
- **GET /api/v1/alerts** - 警報一覧
- **GET /api/v1/cameras** - カメラ一覧

## 🐻 検出可能

- 熊（bear）- YOLOv8による検出

## 📊 警報レベル

| レベル | 条件 | 色 |
|--------|------|-----|
| 🔴 critical | 信頼度 >= 90% または 複数頭 | 赤 |
| 🟠 warning | 信頼度 >= 70% | オレンジ |
| 🟡 caution | 信頼度 >= 50% | 黄色 |
| 🔵 low | 信頼度 < 50% | 青 |

## 📖 ドキュメント

- [設計書](./DESIGN.md) - 完全なAPI仕様とDB設計

## 🛠️ トラブルシューティング

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
