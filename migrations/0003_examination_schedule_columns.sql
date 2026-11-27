DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examinations'
      AND column_name = 'starts_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examinations'
      AND column_name = 'opens_at'
  ) THEN
    ALTER TABLE examinations RENAME COLUMN starts_at TO opens_at;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examinations'
      AND column_name = 'ends_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'examinations'
      AND column_name = 'closes_at'
  ) THEN
    ALTER TABLE examinations RENAME COLUMN ends_at TO closes_at;
  END IF;
END
$$;

ALTER TABLE examinations
  DROP CONSTRAINT IF EXISTS examinations_publication_consistent;
