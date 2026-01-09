-- Bear Detection System - Database Schema
-- PostGIS拡張の有効化
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================================================
-- cameras（監視カメラ）
-- =============================================================================
CREATE TABLE cameras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- カメラ位置の空間インデックス
CREATE INDEX idx_cameras_location ON cameras USING GIST (location);

-- =============================================================================
-- uploads（アップロード映像）
-- =============================================================================
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    camera_id INTEGER REFERENCES cameras(id) ON DELETE SET NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('video', 'image')),
    file_size BIGINT,
    duration_seconds INTEGER,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recorded_at TIMESTAMP,
    processed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    frame_count INTEGER,
    error_message TEXT,
    -- カメラが未登録の場合の位置情報（オプション）
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8)
);

-- アップロード状態のインデックス
CREATE INDEX idx_uploads_status ON uploads (status);
CREATE INDEX idx_uploads_camera_id ON uploads (camera_id);
CREATE INDEX idx_uploads_uploaded_at ON uploads (uploaded_at DESC);

-- =============================================================================
-- sightings（熊目撃記録）
-- =============================================================================
CREATE TABLE sightings (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    bear_count INTEGER DEFAULT 1,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'warning', 'caution', 'low')),
    image_path VARCHAR(500),
    frame_number INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 目撃位置の空間インデックス
CREATE INDEX idx_sightings_location ON sightings USING GIST (location);
CREATE INDEX idx_sightings_detected_at ON sightings (detected_at DESC);
CREATE INDEX idx_sightings_alert_level ON sightings (alert_level);
CREATE INDEX idx_sightings_upload_id ON sightings (upload_id);

-- =============================================================================
-- detections（検出詳細）
-- =============================================================================
CREATE TABLE detections (
    id SERIAL PRIMARY KEY,
    sighting_id INTEGER REFERENCES sightings(id) ON DELETE CASCADE,
    class_name VARCHAR(50) NOT NULL,
    confidence DECIMAL(5, 4) NOT NULL,
    bbox_x INTEGER NOT NULL,
    bbox_y INTEGER NOT NULL,
    bbox_w INTEGER NOT NULL,
    bbox_h INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detections_sighting_id ON detections (sighting_id);

-- =============================================================================
-- alerts（警報）
-- =============================================================================
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    sighting_id INTEGER REFERENCES sightings(id) ON DELETE CASCADE,
    alert_level VARCHAR(20) NOT NULL CHECK (alert_level IN ('critical', 'warning', 'caution', 'low')),
    message TEXT NOT NULL,
    notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(100)
);

CREATE INDEX idx_alerts_acknowledged ON alerts (acknowledged);
CREATE INDEX idx_alerts_sighting_id ON alerts (sighting_id);
CREATE INDEX idx_alerts_notified_at ON alerts (notified_at DESC);

-- =============================================================================
-- jobs（バックグラウンドジョブ管理）
-- =============================================================================
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_upload_id ON jobs (upload_id);
CREATE INDEX idx_jobs_status ON jobs (status);

-- =============================================================================
-- 初期データ（テスト用サンプルカメラ）
-- =============================================================================
INSERT INTO cameras (name, latitude, longitude, location, description, is_active) VALUES
('山間部カメラA', 35.6812, 139.7671, ST_SetSRID(ST_MakePoint(139.7671, 35.6812), 4326), '山間部の監視カメラ', true),
('林道カメラB', 35.6895, 139.6917, ST_SetSRID(ST_MakePoint(139.6917, 35.6895), 4326), '林道入口の監視カメラ', true),
('農地カメラC', 35.7100, 139.8107, ST_SetSRID(ST_MakePoint(139.8107, 35.7100), 4326), '農地周辺の監視カメラ', true);

-- =============================================================================
-- ビュー: 目撃情報サマリ（地図表示用）
-- =============================================================================
CREATE OR REPLACE VIEW sightings_summary AS
SELECT 
    s.id,
    s.latitude,
    s.longitude,
    s.detected_at,
    s.confidence,
    s.bear_count,
    s.alert_level,
    s.image_path,
    c.id AS camera_id,
    c.name AS camera_name,
    u.file_type
FROM sightings s
LEFT JOIN uploads u ON s.upload_id = u.id
LEFT JOIN cameras c ON u.camera_id = c.id
ORDER BY s.detected_at DESC;
