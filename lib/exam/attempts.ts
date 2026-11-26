import { and, eq } from "drizzle-orm";
import { SUBMIT_GRACE_SECONDS } from "@/lib/config";
import { db } from "@/lib/db";
import {
  answers,
  attempts,
  questions,
  type Attempt,
  type Exam,
} from "@/lib/db/schema";
import { closeFocusLoss } from "@/lib/exam/focus";
import {
  computeAutoScore,
  computeManualScore,
  isFullyGraded,
  round2,
} from "@/lib/exam/scoring";

const GRACE_MS = SUBMIT_GRACE_SECONDS * 1000;

/** Vista previa sin límite de tiempo: se cierra sola a las 24 h. */
const PREVIEW_UNLIMITED_MS = 24 * 60 * 60 * 1000;

/**
 * Deadline de un intento nuevo.
 * - Con duración: inicio + duración, recortado al cierre del examen.
 * - Sin límite: el cierre del examen (el alumno puede usar toda la ventana).
 * Las vistas previas docentes no se recortan al cierre.
 */
export function computeDeadline(
  exam: Pick<Exam, "durationMinutes" | "closesAt">,
  now: Date,
  isPreview: boolean,
): Date {
  if (exam.durationMinutes == null) {
    return isPreview ? new Date(now.getTime() + PREVIEW_UNLIMITED_MS) : exam.closesAt;
  }
  const natural = new Date(now.getTime() + exam.durationMinutes * 60_000);
  return !isPreview && natural.getTime() > exam.closesAt.getTime()
    ? exam.closesAt
    : natural;
}

/** Intentos reales (no vista previa) de un alumno en un examen, del más reciente al más viejo. */
export async function listStudentAttempts(examId: string, userId: string) {
  const rows = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.examId, examId),
        eq(attempts.userId, userId),
        eq(attempts.isPreview, false),
      ),
    );
  return rows.sort((a, b) => b.attemptNumber - a.attemptNumber);
}

/** Mejor nota entre los intentos entregados (null si no hay ninguno). */
export function bestSubmittedScore(rows: Attempt[]): number | null {
  const scores = rows
    .filter((row) => row.submittedAt != null)
    .map((row) => row.totalScore);
  return scores.length > 0 ? Math.max(...scores) : null;
}

/** Pasado el deadline (con tolerancia de red) ya no se aceptan escrituras. */
export function isPastDeadline(attempt: Attempt, now: Date = new Date()): boolean {
  return now.getTime() > attempt.deadlineAt.getTime() + GRACE_MS;
}

/** Momento real de entrega: nunca después del deadline. */
export function effectiveSubmitAt(attempt: Attempt, now: Date = new Date()): Date {
  return now.getTime() > attempt.deadlineAt.getTime() ? attempt.deadlineAt : now;
}

/**
 * Recalcula todos los puntajes del intento desde la base.
 * El cliente nunca aporta puntajes: siempre se derivan de las respuestas.
 */
export async function recalcAttempt(attemptId: string) {
  const attempt = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  if (!attempt) return null;

  const [examQuestions, answerRows] = await Promise.all([
    db.select().from(questions).where(eq(questions.examId, attempt.examId)),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)),
  ]);

  const autoScore = computeAutoScore(examQuestions, answerRows);
  const manualScore = computeManualScore(answerRows);
  const totalScore = round2(autoScore + manualScore);

  // Solo se puede pasar a 'graded' un intento ya entregado.
  const status =
    attempt.submittedAt != null && isFullyGraded(examQuestions, answerRows)
      ? "graded"
      : attempt.status;

  await db
    .update(attempts)
    .set({ autoScore, manualScore, totalScore, status })
    .where(eq(attempts.id, attemptId));

  return { autoScore, manualScore, totalScore, status };
}

/**
 * Cierra el intento (por envío manual o por vencimiento) y consolida la nota.
 * Es idempotente: si ya estaba entregado, no lo toca.
 */
export async function finalizeAttempt(attemptId: string) {
  const attempt = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  if (!attempt) return null;
  if (attempt.submittedAt != null) return recalcAttempt(attemptId);

  const now = new Date();
  const submittedAt = effectiveSubmitAt(attempt, now);
  // Si el alumno estaba fuera de foco al entregar/vencer, esa salida se cierra acá.
  await closeFocusLoss(attemptId, submittedAt);
  await db
    .update(attempts)
    .set({ submittedAt, status: "submitted" })
    .where(eq(attempts.id, attemptId));

  return recalcAttempt(attemptId);
}

/**
 * Expiración perezosa: se evalúa al leer, sin depender de cron
 * (en Vercel Hobby los cron corren como máximo 1 vez por día).
 */
export async function finalizeIfExpired(attempt: Attempt) {
  if (attempt.submittedAt != null) return attempt;
  if (!isPastDeadline(attempt)) return attempt;

  await finalizeAttempt(attempt.id);

  const updated = await db.query.attempts.findFirst({
    where: eq(attempts.id, attempt.id),
  });
  return updated ?? attempt;
}
