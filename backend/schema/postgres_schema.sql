-- TapID - normalized relational reference schema (PostgreSQL 15+)
-- The running MVP stores the same entities as MongoDB collections with equivalent
-- unique / partial indexes (see backend/tapid/db.py). This DDL is the canonical
-- relational design and can be applied to Supabase/PostgreSQL when migrating.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE enrollment_status AS ENUM ('pending', 'active', 'suspended', 'graduated');
CREATE TYPE credential_status AS ENUM ('active', 'revoked');
CREATE TYPE verify_method     AS ENUM ('nfc', 'qr');
CREATE TYPE verify_result     AS ENUM ('granted', 'denied');

CREATE TABLE administrators (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT NOT NULL UNIQUE,
    password_hash TEXT   NOT NULL,
    full_name     TEXT   NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             CITEXT NOT NULL UNIQUE,
    password_hash     TEXT   NOT NULL,
    full_name         TEXT   NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
    student_number    VARCHAR(20) NOT NULL UNIQUE,
    program           TEXT   NOT NULL,
    enrollment_status enrollment_status NOT NULL DEFAULT 'pending',
    photo_path        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_status_idx ON students (enrollment_status);

CREATE TABLE digital_credentials (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    credential_uid VARCHAR(32) NOT NULL UNIQUE,
    status         credential_status NOT NULL DEFAULT 'active',
    device_label   TEXT NOT NULL DEFAULT 'Primary mobile device',
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    issued_by      UUID REFERENCES administrators(id),
    revoked_at     TIMESTAMPTZ,
    revoke_reason  TEXT,
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
-- At most one active credential per student
CREATE UNIQUE INDEX one_active_credential ON digital_credentials (student_id) WHERE status = 'active';

CREATE TABLE buildings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    code        VARCHAR(10) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_permissions (
    student_id  UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES administrators(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, building_id)
);
CREATE INDEX access_permissions_building_idx ON access_permissions (building_id);

CREATE TABLE verification_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
    credential_id UUID REFERENCES digital_credentials(id) ON DELETE SET NULL,
    building_id   UUID REFERENCES buildings(id) ON DELETE SET NULL,
    reader_id     VARCHAR(60) NOT NULL,
    method        verify_method NOT NULL,
    result        verify_result NOT NULL,
    reason        VARCHAR(40) NOT NULL,
    nonce         VARCHAR(64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX verification_logs_created_idx  ON verification_logs (created_at DESC);
CREATE INDEX verification_logs_student_idx  ON verification_logs (student_id, created_at DESC);
CREATE INDEX verification_logs_building_idx ON verification_logs (building_id, created_at DESC);

-- Replay protection: each tap-token nonce may be consumed exactly once.
CREATE TABLE used_nonces (
    nonce      VARCHAR(64) PRIMARY KEY,
    used_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX used_nonces_expiry_idx ON used_nonces (expires_at); -- purge job deletes expired rows
