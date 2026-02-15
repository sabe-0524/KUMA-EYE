#!/bin/bash
# ローカル開発環境停止スクリプト

echo "🛑 クマ検出警報システム - ローカル停止"
echo ""

# PIDファイルの確認と停止
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "🔧 バックエンドを停止中 (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        echo "✅ バックエンド停止完了"
    else
        echo "⚠️  バックエンドは既に停止しています"
    fi
    rm .backend.pid
else
    echo "⚠️  バックエンドのPIDファイルが見つかりません"
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "🎨 フロントエンドを停止中 (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        echo "✅ フロントエンド停止完了"
    else
        echo "⚠️  フロントエンドは既に停止しています"
    fi
    rm .frontend.pid
else
    echo "⚠️  フロントエンドのPIDファイルが見つかりません"
fi

# ポート8000と3000を使用しているプロセスを強制終了（念のため）
echo ""
echo "🔍 ポートを使用しているプロセスをチェック中..."
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "✅ ポート8000を解放しました" || echo "   ポート8000は空いています"
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ ポート3000を解放しました" || echo "   ポート3000は空いています"

# Docker の DB/Redis コンテナを停止
echo ""
echo "🐳 Docker コンテナを停止中..."
if docker info > /dev/null 2>&1; then
    docker compose stop db redis 2>/dev/null && echo "✅ DB/Redis コンテナ停止完了" || echo "   Docker コンテナは起動していません"
else
    echo "   Docker は起動していません"
fi

echo ""
echo "🎉 停止完了！"
