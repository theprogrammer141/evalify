DO $$
BEGIN
  CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE monitoring_event_type AS ENUM (
    'CONNECTION_INTERRUPTION',
    'CONNECTION_RESTORED',
    'SAVE_FAILURE',
    'BROWSER_HIDDEN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS examination_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examination_attempt_candidate_unique
    UNIQUE (examination_id, candidate_id),
  CONSTRAINT examination_attempt_identity_unique
    UNIQUE (id, examination_id, candidate_id),
  CONSTRAINT examination_attempt_enrollment_fk
    FOREIGN KEY (examination_id, candidate_id)
    REFERENCES examination_enrollments(examination_id, candidate_id)
    ON DELETE CASCADE,
  CONSTRAINT examination_attempt_deadline_ordered
    CHECK (expires_at > started_at),
  CONSTRAINT examination_attempt_final_state_consistent CHECK (
    (status = 'IN_PROGRESS' AND submitted_at IS NULL AND finalized_at IS NULL) OR
    (status = 'SUBMITTED' AND submitted_at IS NOT NULL AND finalized_at IS NOT NULL) OR
    (status = 'EXPIRED' AND submitted_at IS NULL AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS examination_attempt_examination_status_idx
  ON examination_attempts(examination_id, status);
CREATE INDEX IF NOT EXISTS examination_attempt_expiry_idx
  ON examination_attempts(expires_at)
  WHERE status = 'IN_PROGRESS';

CREATE TABLE IF NOT EXISTS attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE,
  source_assignment_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  prompt varchar(8000) NOT NULL,
  type question_type NOT NULL,
  marks integer NOT NULL CHECK (marks > 0),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT attempt_questions_position_unique UNIQUE (attempt_id, position),
  CONSTRAINT attempt_questions_identity_unique UNIQUE (id, attempt_id)
);

CREATE INDEX IF NOT EXISTS attempt_questions_attempt_idx
  ON attempt_questions(attempt_id);

CREATE TABLE IF NOT EXISTS examination_attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL,
  response jsonb NOT NULL,
  marked_for_review boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examination_attempt_answers_question_unique UNIQUE (question_id),
  CONSTRAINT examination_attempt_answers_question_attempt_fk
    FOREIGN KEY (question_id, attempt_id)
    REFERENCES attempt_questions(id, attempt_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS examination_attempt_answers_attempt_idx
  ON examination_attempt_answers(attempt_id);

CREATE TABLE IF NOT EXISTS monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES examination_attempts(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type monitoring_event_type NOT NULL,
  context varchar(500) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monitoring_events_attempt_relationship_fk
    FOREIGN KEY (attempt_id, examination_id, candidate_id)
    REFERENCES examination_attempts(id, examination_id, candidate_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS monitoring_events_examination_recorded_idx
  ON monitoring_events(examination_id, recorded_at);
CREATE INDEX IF NOT EXISTS monitoring_events_candidate_recorded_idx
  ON monitoring_events(candidate_id, recorded_at);

CREATE TABLE IF NOT EXISTS examination_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body varchar(2000) NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS examination_announcements_history_idx
  ON examination_announcements(examination_id, published_at);

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id uuid NOT NULL
    REFERENCES examination_announcements(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_candidate_unique
    UNIQUE (announcement_id, candidate_id)
);
