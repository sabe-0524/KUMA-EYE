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
