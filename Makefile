# Bear Detection System - Makefile

.PHONY: help dev stop clean logs seed test build

# デフォルトターゲット
help:
	@echo "🐻 クマ検出警報システム"
	@echo ""
	@echo "利用可能なコマンド:"
	@echo "  make dev      - 開発環境を起動"
	@echo "  make stop     - 開発環境を停止"
	@echo "  make clean    - 開発環境を停止しデータを削除"
	@echo "  make logs     - ログを表示"
	@echo "  make seed     - サンプルデータを投入"
	@echo "  make build    - イメージを再ビルド"
	@echo "  make backend  - バックエンドのログを表示"
	@echo "  make frontend - フロントエンドのログを表示"
	@echo "  make db       - データベースに接続"

# 開発環境起動
dev:
	@chmod +x scripts/*.sh
	@./scripts/start-dev.sh

# 停止
stop:
	@./scripts/stop-dev.sh

# 完全クリーン
clean:
	@./scripts/stop-dev.sh --clean

# ログ表示
logs:
	docker compose logs -f

# サンプルデータ投入
seed:
	@chmod +x scripts/seed_data.sh
	@./scripts/seed_data.sh

# イメージ再ビルド
build:
	docker compose build --no-cache

# バックエンドログ
backend:
	docker compose logs -f backend celery

# フロントエンドログ
frontend:
	docker compose logs -f frontend

# データベース接続
db:
	docker compose exec db psql -U bearuser -d bear_detection_db

# Celeryワーカーログ
celery:
	docker compose logs -f celery

# Redisに接続
redis:
	docker compose exec redis redis-cli

# テスト実行
test:
	docker compose exec backend pytest

# 状態確認
status:
	@echo "🔍 サービス状態:"
	@docker compose ps

# シェルに入る
shell-backend:
	docker compose exec backend /bin/bash

shell-frontend:
	docker compose exec frontend /bin/sh
