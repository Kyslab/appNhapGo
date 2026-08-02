CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS wood_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_code text NOT NULL,
  original_filename text NOT NULL,
  source_sha256 text NOT NULL UNIQUE,
  sheet_name text NOT NULL,
  header_row integer NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  total_volume_cbm numeric(16, 6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wood_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES wood_imports(id) ON DELETE CASCADE,
  sequence_no integer,
  cargo text,
  log_no text NOT NULL,
  normalized_log_no text NOT NULL,
  length_m numeric(12, 3),
  diameter_cm numeric(12, 3),
  volume_cbm numeric(16, 6),
  source_row integer NOT NULL,
  row_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received')),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, normalized_log_no)
);

CREATE INDEX IF NOT EXISTS wood_logs_normalized_log_no_idx
  ON wood_logs (normalized_log_no);

CREATE INDEX IF NOT EXISTS wood_logs_import_status_idx
  ON wood_logs (import_id, status);

CREATE TABLE IF NOT EXISTS wood_log_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES wood_logs(id) ON DELETE CASCADE,
  photo_data bytea NOT NULL,
  mime_type text NOT NULL,
  original_filename text NOT NULL,
  byte_size integer NOT NULL,
  sha256 text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (log_id, sha256)
);

CREATE INDEX IF NOT EXISTS wood_log_photos_log_id_idx
  ON wood_log_photos (log_id, created_at DESC);

