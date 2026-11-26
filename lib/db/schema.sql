-- ===========================================================================
--  Esquema · Aula Evalúa (idempotente: se puede volver a ejecutar)
--  Pegar en Neon Console > SQL Editor (o usar `pnpm db:push`)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub    text UNIQUE,
  email         text NOT NULL UNIQUE,
  name          text,
  picture       text,
  password_hash text,
  must_change_password boolean NOT NULL DEFAULT true,
  role          text NOT NULL DEFAULT 'student',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS exams (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  text NOT NULL UNIQUE,
  title                 text NOT NULL,
  description           text,
  status                text NOT NULL DEFAULT 'draft',
  opens_at              timestamptz NOT NULL,
  closes_at             timestamptz NOT NULL,
  duration_minutes      integer DEFAULT 60,
  max_attempts          integer NOT NULL DEFAULT 1,
  shuffle_questions     boolean NOT NULL DEFAULT true,
  shuffle_options       boolean NOT NULL DEFAULT true,
  warn_after_seconds    integer NOT NULL DEFAULT 10,
  max_warnings          integer NOT NULL DEFAULT 3,
  results_published_at  timestamptz,
  show_score_on_submit  boolean NOT NULL DEFAULT false,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- duration_minutes NULL = sin límite de tiempo.
ALTER TABLE exams ALTER COLUMN duration_minutes DROP NOT NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_score_on_submit boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  position       integer NOT NULL DEFAULT 0,
  type           text NOT NULL DEFAULT 'mc',
  prompt         text NOT NULL,
  points         double precision NOT NULL DEFAULT 1,
  options        jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option integer,
  rubric         text
);

CREATE INDEX IF NOT EXISTS questions_exam_idx ON questions (exam_id, position);

CREATE TABLE IF NOT EXISTS exam_students (
  exam_id  uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  email    text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (exam_id, email)
);

CREATE TABLE IF NOT EXISTS attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_preview    boolean NOT NULL DEFAULT false,
  attempt_number integer NOT NULL DEFAULT 1,
  started_at    timestamptz NOT NULL DEFAULT now(),
  deadline_at   timestamptz NOT NULL,
  submitted_at  timestamptz,
  status        text NOT NULL DEFAULT 'in_progress',
  auto_score    double precision NOT NULL DEFAULT 0,
  manual_score  double precision NOT NULL DEFAULT 0,
  total_score   double precision NOT NULL DEFAULT 0,
  ip            text,
  user_agent    text,
  focus_loss_count    integer NOT NULL DEFAULT 0,
  focus_lost_ms       integer NOT NULL DEFAULT 0,
  focus_warning_count integer NOT NULL DEFAULT 0,
  focus_lost_since    timestamptz
);

ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_loss_count integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_lost_ms integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_warning_count integer NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS focus_lost_since timestamptz;

-- Intentos múltiples: número único por alumno y examen, y como máximo uno abierto.
-- Las vistas previas no consumen intentos reales.
DROP INDEX IF EXISTS attempts_exam_user_uq;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_exam_user_number_uq
  ON attempts (exam_id, user_id, attempt_number)
  WHERE is_preview = false;
CREATE UNIQUE INDEX IF NOT EXISTS attempts_exam_user_open_uq
  ON attempts (exam_id, user_id)
  WHERE is_preview = false AND submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS attempts_exam_idx ON attempts (exam_id);

CREATE TABLE IF NOT EXISTS answers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option  integer,
  answer_text      text,
  points_awarded   double precision,
  feedback         text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS answers_attempt_question_uq ON answers (attempt_id, question_id);

CREATE TABLE IF NOT EXISTS events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  type       text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  meta       jsonb
);

CREATE INDEX IF NOT EXISTS events_attempt_idx ON events (attempt_id, at);
