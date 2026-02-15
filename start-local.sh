#!/bin/bash
# ローカル開発環境起動スクリプト

echo "🐻 クマ検出警報システム - ローカル起動"
echo ""

# バックエンドディレクトリの確認
if [ ! -d "backend/venv" ]; then
    echo "❌ バックエンドの仮想環境が見つかりません"
    echo "以下のコマンドで作成してください:"
    echo "  cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# フロントエンドディレクトリの確認
if [ ! -d "frontend/node_modules" ]; then
    echo "❌ フロントエンドの依存関係がインストールされていません"
    echo "以下のコマンドで作成してください:"
    echo "  cd frontend && npm install"
    exit 1
fi

# --- Docker で DB と Redis を起動 ---
echo "🐳 Docker の起動を確認中..."
if ! docker info > /dev/null 2>&1; then
    echo "⏳ Docker Desktop を起動しています..."
    open -a Docker 2>/dev/null || true
    # 最大90秒待機
    for i in $(seq 1 30); do
        docker info > /dev/null 2>&1 && break
        echo "  Docker 起動待機中... ($i/30)"
        sleep 3
    done
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker Desktop が起動できませんでした"
        echo "Docker Desktop を手動で起動してから再度実行してください"
        exit 1
    fi
fi
echo "✅ Docker 起動確認"

echo "🗄️  PostgreSQL と Redis を起動中..."
docker compose up -d db redis

# DB の healthcheck が通るまで待機（最大60秒）
echo "⏳ PostgreSQL の準備を待機中..."
for i in $(seq 1 20); do
    if docker compose exec -T db pg_isready -U bearuser -d bear_detection_db > /dev/null 2>&1; then
        echo "✅ PostgreSQL 準備完了"
        break
    fi
    if [ "$i" -eq 20 ]; then
        echo "❌ PostgreSQL の起動がタイムアウトしました"
        echo "  docker compose logs db で状態を確認してください"
        exit 1
    fi
    sleep 3
done

# Redis の準備確認
echo "⏳ Redis の準備を待機中..."
for i in $(seq 1 10); do
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis 準備完了"
        break
    fi
    if [ "$i" -eq 10 ]; then
        echo "❌ Redis の起動がタイムアウトしました"
        exit 1
    fi
    sleep 2
done

# バックエンド起動
echo "🔧 バックエンドを起動中..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "✅ バックエンド起動完了 (PID: $BACKEND_PID)"
echo "   URL: http://localhost:8000"
echo "   ログ: tail -f backend.log"
echo ""

# 少し待つ
sleep 2

# フロントエンド起動
echo "🎨 フロントエンドを起動中..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "✅ フロントエンド起動完了 (PID: $FRONTEND_PID)"
echo "   URL: http://localhost:3000"
echo "   ログ: tail -f frontend.log"
echo ""

# PIDをファイルに保存
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

echo "🎉 起動完了！"
echo ""
echo "📝 停止するには: ./stop-local.sh"
echo "📊 ログを見るには: tail -f backend.log または tail -f frontend.log"
echo ""
echo "🌐 アプリにアクセス: http://localhost:3000"
