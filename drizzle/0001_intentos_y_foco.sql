-- Aula Evalúa · intentos configurables, examen sin límite de tiempo y métricas de foco.
-- Idempotente. Ejecutar en Neon Console > SQL Editor o con `psql "$DATABASE_URL" -f`.
BEGIN;

ALTER TABLE exams ALTER COLUMN duration_minutes DROP NOT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1;

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_loss_count integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_lost_ms integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_warning_count integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_lost_since timestamptz;

DROP INDEX IF EXISTS attempts_exam_user_uq;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_exam_user_number_uq
  ON attempts (exam_id, user_id, attempt_number)
  WHERE is_preview = false;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_exam_user_open_uq
  ON attempts (exam_id, user_id)
  WHERE is_preview = false AND submitted_at IS NULL;

-- Retroactivo: cantidad de salidas (eventos 'hidden') de los intentos existentes.
UPDATE attempts a
SET focus_loss_count = sub.n
FROM (
  SELECT attempt_id, count(*)::int AS n
  FROM events WHERE type = 'hidden'
  GROUP BY attempt_id
) sub
WHERE sub.attempt_id = a.id AND a.focus_loss_count = 0;

COMMIT;
