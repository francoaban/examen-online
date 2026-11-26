import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*  Usuarios                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  picture: text("picture"),
  passwordHash: text("password_hash"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // 'student' | 'teacher'
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Exámenes                                                                   */
/* -------------------------------------------------------------------------- */

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  // 'draft' | 'open' | 'closed'
  status: text("status").notNull().default("draft"),
  opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
  // null = sin límite de tiempo (el intento vence al cierre del examen).
  durationMinutes: integer("duration_minutes").default(60),
  // Cantidad de intentos reales permitidos por alumno (las vistas previas no cuentan).
  maxAttempts: integer("max_attempts").notNull().default(1),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(true),
  shuffleOptions: boolean("shuffle_options").notNull().default(true),
  // Segundos de ausencia de foco a partir de los cuales se cuenta una advertencia.
  warnAfterSeconds: integer("warn_after_seconds").notNull().default(10),
  // Cantidad de advertencias a partir de la cual el banner pasa a rojo.
  maxWarnings: integer("max_warnings").notNull().default(3),
  resultsPublishedAt: timestamp("results_published_at", { withTimezone: true }),
  // Si es true, el alumno ve su nota apenas entrega (sin esperar la publicación).
  showScoreOnSubmit: boolean("show_score_on_submit").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Preguntas                                                                  */
/* -------------------------------------------------------------------------- */

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    // 'mc' (múltiple opción) | 'text' (desarrollo)
    type: text("type").notNull().default("mc"),
    prompt: text("prompt").notNull(),
    points: doublePrecision("points").notNull().default(1),
    // Solo para 'mc': array de textos de opciones.
    options: jsonb("options").$type<string[]>().notNull().default([]),
    // Solo para 'mc': índice (0-based) de la opción correcta. NUNCA se envía al alumno.
    correctOption: integer("correct_option"),
    // Solo para 'text': guía de corrección para el docente.
    rubric: text("rubric"),
  },
  (t) => [index("questions_exam_idx").on(t.examId, t.position)],
);

/* -------------------------------------------------------------------------- */
/*  Roster (lista blanca de emails por examen)                                 */
/* -------------------------------------------------------------------------- */

export const examStudents = pgTable(
  "exam_students",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.email] })],
);

/* -------------------------------------------------------------------------- */
/*  Intentos                                                                   */
/* -------------------------------------------------------------------------- */

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPreview: boolean("is_preview").notNull().default(false),
    // 1, 2, 3… por alumno y examen (las vistas previas siempre son 1).
    attemptNumber: integer("attempt_number").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    // Fijado al iniciar: cerrar la pestaña NO detiene el reloj.
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    // 'in_progress' | 'submitted' | 'graded'
    status: text("status").notNull().default("in_progress"),
    autoScore: doublePrecision("auto_score").notNull().default(0),
    manualScore: doublePrecision("manual_score").notNull().default(0),
    totalScore: doublePrecision("total_score").notNull().default(0),
    ip: text("ip"),
    userAgent: text("user_agent"),
    // Auditoría de foco, calculada en el servidor a partir de los eventos.
    focusLossCount: integer("focus_loss_count").notNull().default(0),
    focusLostMs: integer("focus_lost_ms").notNull().default(0),
    // Salidas cuya duración superó exams.warn_after_seconds.
    focusWarningCount: integer("focus_warning_count").notNull().default(0),
    // Inicio de la salida de foco en curso (null = el alumno está en la pestaña).
    focusLostSince: timestamp("focus_lost_since", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("attempts_exam_user_number_uq")
      .on(t.examId, t.userId, t.attemptNumber)
      .where(sql`${t.isPreview} = false`),
    // Como máximo un intento real abierto por alumno y examen.
    uniqueIndex("attempts_exam_user_open_uq")
      .on(t.examId, t.userId)
      .where(sql`${t.isPreview} = false and ${t.submittedAt} is null`),
    index("attempts_exam_idx").on(t.examId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Respuestas                                                                 */
/* -------------------------------------------------------------------------- */

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedOption: integer("selected_option"),
    answerText: text("answer_text"),
    pointsAwarded: doublePrecision("points_awarded"),
    feedback: text("feedback"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("answers_attempt_question_uq").on(t.attemptId, t.questionId)],
);

/* -------------------------------------------------------------------------- */
/*  Eventos (auditoría: foco, heartbeat, cierre de pestaña)                    */
/* -------------------------------------------------------------------------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    // heartbeat | hidden | visible | blur | focus | pagehide | copy | paste
    type: text("type").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("events_attempt_idx").on(t.attemptId, t.at)],
);

export type User = typeof users.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type AnswerRow = typeof answers.$inferSelect;
export type EventRow = typeof events.$inferSelect;
