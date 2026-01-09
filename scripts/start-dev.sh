#!/bin/bash
# 開発環境起動スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🐻 クマ検出警報システム - 開発環境起動"
echo "========================================"

# .envファイル確認
if [ ! -f "backend/.env" ]; then
    echo "⚠️  backend/.env が見つかりません。サンプルからコピーします..."
    cp backend/.env.example backend/.env
    echo "✅ backend/.env を作成しました"
fi

# Dockerの確認
if ! command -v docker &> /dev/null; then
    echo "❌ Dockerがインストールされていません"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Composeがインストールされていません"
    exit 1
fi

# 起動
echo ""
echo "🚀 Docker Composeでサービスを起動中..."
docker compose up -d --build

# 起動待機
echo ""
echo "⏳ サービスの起動を待機中..."
sleep 5

# ヘルスチェック
echo ""
echo "🔍 ヘルスチェック中..."

# Backend
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend API: 正常"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Backend API: 起動中..."
    fi
    sleep 2
done

# Frontend
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend: 正常"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Frontend: 起動中..."
    fi
    sleep 2
done

# Database
if docker compose exec -T db pg_isready -U bearuser > /dev/null 2>&1; then
    echo "✅ PostgreSQL: 正常"
else
    echo "⚠️  PostgreSQL: 起動中..."
fi

# Redis
if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 正常"
else
    echo "⚠️  Redis: 起動中..."
fi

echo ""
echo "========================================"
echo "🎉 起動完了！"
echo ""
echo "📌 アクセスURL:"
echo "  - フロントエンド: http://localhost:3000"
echo "  - API ドキュメント: http://localhost:8000/docs"
echo "  - API エンドポイント: http://localhost:8000/api/v1"
echo ""
echo "📋 便利なコマンド:"
echo "  - ログ確認: docker compose logs -f"
echo "  - 停止: docker compose down"
echo "  - 再起動: docker compose restart"
echo ""
echo "🐻 サンプルデータを投入するには:"
echo "  ./scripts/seed_data.sh"
