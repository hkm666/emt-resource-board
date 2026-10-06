-- EMT Resource Board schema for Neon Postgres
-- Mirrors the original server.js JSON shape: id + JSONB data per row.

CREATE TABLE IF NOT EXISTS people (
  id        TEXT PRIMARY KEY,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id        TEXT PRIMARY KEY,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id        TEXT PRIMARY KEY,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS holidays (
  id        TEXT PRIMARY KEY,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id        TEXT PRIMARY KEY,
  data      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_person ON bookings ((data->>'personId'));
CREATE INDEX IF NOT EXISTS idx_bookings_project ON bookings ((data->>'projectId'));
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_people_active ON people ((data->>'active'));