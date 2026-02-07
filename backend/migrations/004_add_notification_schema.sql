-- =============================================================================
-- Notification schema for nearby email alerts
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS location GEOMETRY(Point, 4326);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_users_location_updated_at ON users (location_updated_at DESC);

CREATE TABLE IF NOT EXISTS alert_notifications (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_alert_notifications_alert_user_channel UNIQUE (alert_id, user_id, channel),
    CONSTRAINT chk_alert_notifications_channel CHECK (channel IN ('email')),
    CONSTRAINT chk_alert_notifications_status CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_id ON alert_notifications (alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_id ON alert_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON alert_notifications (status);
