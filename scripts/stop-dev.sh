#!/bin/bash
# システム停止スクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🐻 クマ検出警報システム - 停止"
echo "========================================"

# オプション処理
REMOVE_VOLUMES=false
for arg in "$@"; do
    case $arg in
        --clean)
            REMOVE_VOLUMES=true
            ;;
    esac
done

if [ "$REMOVE_VOLUMES" = true ]; then
    echo "⚠️  ボリュームも含めて完全に削除します..."
    docker compose down -v --remove-orphans
    echo "✅ コンテナとボリュームを削除しました"
else
    docker compose down
    echo "✅ コンテナを停止しました"
    echo ""
    echo "💡 ヒント: データを完全に削除するには --clean オプションを使用してください"
    echo "   ./scripts/stop-dev.sh --clean"
fi
