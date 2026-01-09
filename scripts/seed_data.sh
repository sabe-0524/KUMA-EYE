#!/bin/bash
# サンプルデータを投入するスクリプト

set -e

API_URL="${API_URL:-http://localhost:8000/api/v1}"

echo "🐻 クマ検出システム - サンプルデータ投入"
echo "========================================"

# APIが起動するまで待機
echo "📡 API起動待機中..."
for i in {1..30}; do
    if curl -s "${API_URL}/../health" > /dev/null 2>&1; then
        echo "✅ APIが起動しました"
        break
    fi
    echo "  待機中... ($i/30)"
    sleep 2
done

# カメラを登録
echo ""
echo "📹 カメラを登録中..."

# カメラ1: 山間部
curl -s -X POST "${API_URL}/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "山間部監視カメラA",
    "latitude": 36.2048,
    "longitude": 137.2529,
    "description": "北アルプス山麓の監視カメラ"
  }' | jq -r '"\(.id): \(.name)"'

# カメラ2: 林道
curl -s -X POST "${API_URL}/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "林道カメラB",
    "latitude": 35.6762,
    "longitude": 138.8514,
    "description": "富士山麓の林道監視カメラ"
  }' | jq -r '"\(.id): \(.name)"'

# カメラ3: 農地
curl -s -X POST "${API_URL}/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "農地監視カメラC",
    "latitude": 39.7036,
    "longitude": 141.1527,
    "description": "岩手県農地の監視カメラ"
  }' | jq -r '"\(.id): \(.name)"'

# カメラ4: 住宅地
curl -s -X POST "${API_URL}/cameras" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "住宅地カメラD",
    "latitude": 43.0618,
    "longitude": 141.3545,
    "description": "札幌市郊外の監視カメラ"
  }' | jq -r '"\(.id): \(.name)"'

echo ""
echo "✅ カメラの登録が完了しました"

# カメラ一覧を表示
echo ""
echo "📋 登録されたカメラ一覧:"
curl -s "${API_URL}/cameras" | jq -r '.cameras[] | "  - \(.id): \(.name) (\(.latitude), \(.longitude))"'

echo ""
echo "========================================"
echo "✅ サンプルデータの投入が完了しました！"
echo ""
echo "次のステップ:"
echo "  1. フロントエンドにアクセス: http://localhost:3000"
echo "  2. 画像をアップロードして熊検出をテスト"
echo "  3. APIドキュメント: http://localhost:8000/docs"
