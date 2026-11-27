ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

DO $$
BEGIN
  ALTER TABLE evaluations
    ADD CONSTRAINT evaluations_publication_consistent CHECK (
      (published_by IS NULL AND published_at IS NULL)
      OR
      (status = 'FINALIZED' AND published_by IS NOT NULL AND published_at IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE issued_report_status AS ENUM ('VALID', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS issued_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE RESTRICT,
  evaluation_id uuid NOT NULL UNIQUE REFERENCES evaluations(id) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verification_token varchar(64) NOT NULL UNIQUE,
  report_snapshot jsonb NOT NULL,
  status issued_report_status NOT NULL DEFAULT 'VALID',
  issued_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  CONSTRAINT issued_reports_token_format CHECK (
    verification_token ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT issued_reports_snapshot_object CHECK (
    jsonb_typeof(report_snapshot) = 'object'
  ),
  CONSTRAINT issued_reports_evaluation_attempt_fk
    FOREIGN KEY (evaluation_id, attempt_id)
    REFERENCES evaluations (id, attempt_id) ON DELETE RESTRICT,
  CONSTRAINT issued_reports_attempt_identity_fk
    FOREIGN KEY (examination_id, candidate_id)
    REFERENCES attempts (examination_id, candidate_id) ON DELETE RESTRICT,
  CONSTRAINT issued_reports_revocation_consistent CHECK (
    (status = 'VALID' AND revoked_by IS NULL AND revoked_at IS NULL)
    OR
    (status = 'REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS issued_reports_candidate_issued_idx
  ON issued_reports (candidate_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS issued_reports_examination_issued_idx
  ON issued_reports (examination_id, issued_at DESC);
