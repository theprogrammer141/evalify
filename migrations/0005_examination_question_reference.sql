DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examination_questions'
      AND column_name = 'source_question_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examination_questions'
      AND column_name = 'question_id'
  ) THEN
    ALTER TABLE examination_questions
      RENAME COLUMN source_question_id TO question_id;
  END IF;
END
$$;
