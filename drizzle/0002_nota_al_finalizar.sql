-- Aula Evalúa · opción "mostrar la nota al finalizar el examen".
-- Idempotente. Ejecutar en Neon Console > SQL Editor o con `psql "$DATABASE_URL" -f`.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_score_on_submit boolean NOT NULL DEFAULT false;
