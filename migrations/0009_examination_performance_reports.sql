CREATE TABLE IF NOT EXISTS examination_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  generated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verification_token varchar(64) NOT NULL UNIQUE,
  report_snapshot jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examination_reports_token_format CHECK (
    verification_token ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT examination_reports_snapshot_object CHECK (
    jsonb_typeof(report_snapshot) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS examination_reports_examination_generated_idx
  ON examination_reports (examination_id, generated_at DESC);
