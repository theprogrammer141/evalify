DO $$
DECLARE
  legacy_column text;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY[
    'prompt',
    'category',
    'difficulty',
    'type',
    'options',
    'answer_key'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'examination_questions'
        AND column_name = legacy_column
        AND is_nullable = 'NO'
    ) THEN
      EXECUTE format(
        'ALTER TABLE examination_questions ALTER COLUMN %I DROP NOT NULL',
        legacy_column
      );
    END IF;
  END LOOP;
END
$$;
