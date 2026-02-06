-- =============================================================================
-- usersテーブルの不足カラム補完
-- =============================================================================
-- 既にusersテーブルが存在していても安全に適用できるようにする

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

