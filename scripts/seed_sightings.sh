#!/bin/bash
# サンプルの目撃情報（sightings）を直接DBに投入するスクリプト

set -e

echo "🐻 サンプル目撃情報を投入中..."

# PostgreSQLに直接接続してサンプルデータを投入
docker compose exec -T db psql -U bearuser -d bear_detection_db << 'EOF'

-- 既存のsightings, detections, alertsをクリア（テスト用）
DELETE FROM alerts;
DELETE FROM detections;
DELETE FROM sightings;

-- サンプル目撃情報を挿入
INSERT INTO sightings (upload_id, location, latitude, longitude, detected_at, confidence, bear_count, alert_level, image_path, frame_number)
VALUES
  -- 危険レベル（複数頭、高信頼度）
  (NULL, ST_SetSRID(ST_MakePoint(137.2529, 36.2048), 4326), 36.2048, 137.2529, NOW() - INTERVAL '1 hour', 0.95, 2, 'critical', NULL, 0),
  
  -- 警戒レベル（信頼度70%以上）
  (NULL, ST_SetSRID(ST_MakePoint(138.8514, 35.6762), 4326), 35.6762, 138.8514, NOW() - INTERVAL '3 hours', 0.78, 1, 'warning', NULL, 0),
  
  -- 注意レベル（信頼度50%以上）
  (NULL, ST_SetSRID(ST_MakePoint(141.1527, 39.7036), 4326), 39.7036, 141.1527, NOW() - INTERVAL '6 hours', 0.55, 1, 'caution', NULL, 0),
  
  -- 低レベル（信頼度50%未満）
  (NULL, ST_SetSRID(ST_MakePoint(141.3545, 43.0618), 4326), 43.0618, 141.3545, NOW() - INTERVAL '12 hours', 0.42, 1, 'low', NULL, 0),
  
  -- 追加の危険レベル
  (NULL, ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326), 35.6812, 139.7671, NOW() - INTERVAL '30 minutes', 0.92, 1, 'critical', NULL, 0),
  
  -- 追加の警戒レベル
  (NULL, ST_SetSRID(ST_MakePoint(140.1234, 37.5678), 4326), 37.5678, 140.1234, NOW() - INTERVAL '2 hours', 0.75, 1, 'warning', NULL, 0);

-- 各sightingに対応する警報を作成
INSERT INTO alerts (sighting_id, alert_level, message, notified_at, acknowledged)
SELECT 
  id,
  alert_level,
  CASE alert_level
    WHEN 'critical' THEN '🔴 危険：熊を検出しました！信頼度' || ROUND(confidence * 100) || '%、' || bear_count || '頭'
    WHEN 'warning' THEN '🟠 警戒：熊の可能性があります。信頼度' || ROUND(confidence * 100) || '%'
    WHEN 'caution' THEN '🟡 注意：熊の可能性（低）。信頼度' || ROUND(confidence * 100) || '%'
    ELSE '🔵 低：確認が必要です。信頼度' || ROUND(confidence * 100) || '%'
  END,
  detected_at,
  false
FROM sightings;

-- 確認
SELECT 'Sightings:' as info, COUNT(*) as count FROM sightings
UNION ALL
SELECT 'Alerts:', COUNT(*) FROM alerts;

EOF

echo ""
echo "✅ サンプル目撃情報の投入が完了しました！"
echo ""
echo "📍 投入した目撃情報:"
curl -s http://localhost:8000/api/v1/sightings | jq -r '.sightings[] | "  - \(.alert_level): (\(.latitude), \(.longitude)) 信頼度\(.confidence * 100 | floor)%"'
