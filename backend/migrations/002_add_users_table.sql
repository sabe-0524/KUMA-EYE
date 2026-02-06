-- =============================================================================
-- users（Firebase認証ユーザー）
-- =============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_firebase_uid ON users (firebase_uid);
CREATE INDEX idx_users_email ON users (email);
