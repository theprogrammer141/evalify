ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS marking_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    JOIN pg_attribute AS a
      ON a.attrelid = c.conrelid
      AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'questions'::regclass
      AND c.contype = 'c'
      AND a.attname = 'marking_rules'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_marking_rules_object
      CHECK (jsonb_typeof(marking_rules) = 'object');
  END IF;
END
$$;
