-- Bear Detection System - Users and Alert Notifications

-- =============================================================================
-- users（通知対象ユーザー）
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    email_opt_in BOOLEAN DEFAULT false,
    location GEOMETRY(Point, 4326),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 位置情報の空間インデックス
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_users_email_opt_in ON users (email_opt_in);
CREATE INDEX IF NOT EXISTS idx_users_location_updated_at ON users (location_updated_at DESC);

-- =============================================================================
-- alert_notifications（通知送信履歴）
-- =============================================================================
CREATE TABLE IF NOT EXISTS alert_notifications (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_alert_notifications UNIQUE (alert_id, user_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_id ON alert_notifications (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_id ON alert_notifications (user_id);
