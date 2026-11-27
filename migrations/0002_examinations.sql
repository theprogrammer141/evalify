DO $$
BEGIN
  CREATE TYPE examination_status AS ENUM ('DRAFT', 'PUBLISHED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE question_type AS ENUM (
    'SINGLE_CHOICE',
    'MULTIPLE_SELECT',
    'WRITTEN_RESPONSE'
  );
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
  title varchar(180) NOT NULL,
  instructions varchar(8000) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  total_marks integer NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
  randomize_questions boolean NOT NULL DEFAULT false,
  randomize_options boolean NOT NULL DEFAULT false,
  status examination_status NOT NULL DEFAULT 'DRAFT',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examinations_schedule_ordered CHECK (ends_at > starts_at),
  CONSTRAINT examinations_publication_consistent CHECK (
    (status = 'DRAFT' AND published_at IS NULL) OR
    (status = 'PUBLISHED' AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS examinations_examiner_updated_idx
  ON examinations(examiner_id, updated_at);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examiner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prompt varchar(8000) NOT NULL,
  category varchar(120) NOT NULL,
  difficulty question_difficulty NOT NULL,
  type question_type NOT NULL,
  marks integer NOT NULL CHECK (marks > 0),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_examiner_updated_idx
  ON questions(examiner_id, updated_at);

CREATE TABLE IF NOT EXISTS examination_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  source_question_id uuid REFERENCES questions(id) ON DELETE SET NULL,
  position integer NOT NULL CHECK (position > 0),
  prompt varchar(8000) NOT NULL,
  category varchar(120) NOT NULL,
  difficulty question_difficulty NOT NULL,
  type question_type NOT NULL,
  marks integer NOT NULL CHECK (marks > 0),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer_key jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS examination_questions_position_unique
  ON examination_questions(examination_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS examination_questions_source_unique
  ON examination_questions(examination_id, source_question_id)
  WHERE source_question_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS examination_questions_examination_idx
  ON examination_questions(examination_id, position);

CREATE TABLE IF NOT EXISTS examination_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id uuid NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT examination_enrollments_candidate_unique
    UNIQUE (examination_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS examination_enrollments_candidate_idx
  ON examination_enrollments(candidate_id);