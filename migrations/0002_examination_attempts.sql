DO $$
BEGIN
  CREATE TYPE question_type AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_SELECT', 'WRITTEN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'WRITTEN_RESPONSE';

DO $$
BEGIN
  CREATE TYPE examination_status AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
ALTER TYPE examination_status ADD VALUE IF NOT EXISTS 'COMPLETED';

DO $$
BEGIN
  CREATE TYPE enrollment_status AS ENUM ('ENROLLED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE question_difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS examinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examiner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title varchar(240) NOT NULL,
  instructions text NOT NULL DEFAULT '',
  status examination_status NOT NULL DEFAULT 'DRAFT',
  total_marks integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  randomize_questions boolean NOT NULL DEFAULT false,
  randomize_options boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examinations_window_valid CHECK (closes_at > opens_at)
);
ALTER TABLE examinations
  ADD COLUMN IF NOT EXISTS total_marks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS examinations_examiner_id_idx
  ON examinations(examiner_id);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examiner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type question_type NOT NULL,
  prompt text NOT NULL,
  category varchar(120) NOT NULL DEFAULT '',
  difficulty question_difficulty NOT NULL DEFAULT 'MEDIUM',
  options jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(options) = 'array'),
  marks integer NOT NULL CHECK (marks > 0),
  marking_rules jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(marking_rules) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS category varchar(120) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS difficulty question_difficulty NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS questions_examiner_id_idx
  ON questions(examiner_id);

CREATE TABLE IF NOT EXISTS examination_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  position integer NOT NULL CHECK (position >= 0),
  marks integer NOT NULL CHECK (marks > 0),
  CONSTRAINT examination_questions_position_unique
    UNIQUE (examination_id, position),
  CONSTRAINT examination_questions_question_unique
    UNIQUE (examination_id, question_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'ENROLLED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_examination_candidate_unique
    UNIQUE (examination_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS enrollments_candidate_id_idx
  ON enrollments(candidate_id);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempts_examination_candidate_unique
    UNIQUE (examination_id, candidate_id),
  CONSTRAINT attempts_deadline_valid CHECK (expires_at > started_at),
  CONSTRAINT attempts_finalization_consistent CHECK (
    (status = 'IN_PROGRESS' AND finalized_at IS NULL) OR
    (status IN ('SUBMITTED', 'EXPIRED') AND finalized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS attempts_candidate_id_idx ON attempts(candidate_id);
CREATE INDEX IF NOT EXISTS attempts_examination_id_idx
  ON attempts(examination_id);
CREATE INDEX IF NOT EXISTS attempts_status_expires_at_idx
  ON attempts(status, expires_at);

CREATE TABLE IF NOT EXISTS attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  snapshot_question_id uuid NOT NULL,
  answer jsonb,
  marked_for_review boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attempt_answers_attempt_question_unique
    UNIQUE (attempt_id, snapshot_question_id),
  CONSTRAINT attempt_answers_shape_valid CHECK (
    answer IS NULL OR (
      jsonb_typeof(answer) = 'object' AND (
        (
          answer->>'kind' = 'single'
          AND answer - 'kind' - 'optionId' = '{}'::jsonb
          AND jsonb_typeof(answer->'optionId') = 'string'
          AND answer->>'optionId' <> ''
        ) OR (
          answer->>'kind' = 'multiple'
          AND answer - 'kind' - 'optionIds' = '{}'::jsonb
          AND jsonb_typeof(answer->'optionIds') = 'array'
          AND NOT jsonb_path_exists(
            answer,
            '$.optionIds[*] ? (@.type() != "string")'
          )
        ) OR (
          answer->>'kind' = 'written'
          AND answer - 'kind' - 'text' = '{}'::jsonb
          AND jsonb_typeof(answer->'text') = 'string'
        )
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS attempt_answers_attempt_id_idx
  ON attempt_answers(attempt_id);
