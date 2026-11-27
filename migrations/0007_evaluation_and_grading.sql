DO $$
BEGIN
  CREATE TYPE evaluation_status AS ENUM (
    'AUTO_GRADED',
    'AWAITING_MANUAL',
    'PARTIALLY_EVALUATED',
    'COMPLETED',
    'FINALIZED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE evaluation_mark_source AS ENUM ('AUTO', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE evaluation_history_action AS ENUM (
    'EVALUATION_CREATED',
    'MARKS_UPDATED',
    'FINALIZED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL UNIQUE
    REFERENCES attempts(id) ON DELETE RESTRICT,
  examiner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status evaluation_status NOT NULL,
  total_marks integer NOT NULL DEFAULT 0,
  auto_marks integer NOT NULL DEFAULT 0,
  manual_marks integer NOT NULL DEFAULT 0,
  revision integer NOT NULL DEFAULT 0,
  finalized_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_id_attempt_unique UNIQUE (id, attempt_id),
  CONSTRAINT evaluations_marks_nonnegative
    CHECK (total_marks >= 0 AND auto_marks >= 0 AND manual_marks >= 0),
  CONSTRAINT evaluations_marks_sum
    CHECK (total_marks = auto_marks + manual_marks),
  CONSTRAINT evaluations_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT evaluations_finalization_consistent CHECK (
    (status = 'FINALIZED' AND finalized_by IS NOT NULL AND finalized_at IS NOT NULL)
    OR
    (status <> 'FINALIZED' AND finalized_by IS NULL AND finalized_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS evaluations_examiner_status_idx
  ON evaluations (examiner_id, status);

CREATE TABLE IF NOT EXISTS evaluation_question_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  source evaluation_mark_source NOT NULL,
  awarded_marks integer,
  feedback text NOT NULL DEFAULT '',
  graded_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  graded_at timestamptz,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_question_marks_unique
    UNIQUE (evaluation_id, question_id),
  CONSTRAINT evaluation_question_marks_evaluation_attempt_fk
    FOREIGN KEY (evaluation_id, attempt_id)
    REFERENCES evaluations (id, attempt_id) ON DELETE CASCADE,
  CONSTRAINT evaluation_question_marks_attempt_question_fk
    FOREIGN KEY (attempt_id, question_id)
    REFERENCES attempt_answers (attempt_id, snapshot_question_id) ON DELETE RESTRICT,
  CONSTRAINT evaluation_question_marks_awarded_nonnegative
    CHECK (awarded_marks IS NULL OR awarded_marks >= 0),
  CONSTRAINT evaluation_question_marks_revision_nonnegative
    CHECK (revision >= 0),
  CONSTRAINT evaluation_question_marks_source_valid CHECK (
    (source = 'AUTO' AND awarded_marks IS NOT NULL AND graded_by IS NULL AND graded_at IS NOT NULL)
    OR
    (source = 'MANUAL' AND (
      (awarded_marks IS NULL AND graded_by IS NULL AND graded_at IS NULL)
      OR
      (awarded_marks IS NOT NULL AND graded_by IS NOT NULL AND graded_at IS NOT NULL)
    ))
  )
);

CREATE INDEX IF NOT EXISTS evaluation_question_marks_attempt_idx
  ON evaluation_question_marks (attempt_id);

CREATE TABLE IF NOT EXISTS evaluation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  question_id uuid,
  action evaluation_history_action NOT NULL,
  revision integer NOT NULL,
  before_state jsonb,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_history_revision_unique UNIQUE (evaluation_id, revision),
  CONSTRAINT evaluation_history_evaluation_attempt_fk
    FOREIGN KEY (evaluation_id, attempt_id)
    REFERENCES evaluations (id, attempt_id) ON DELETE CASCADE
);
