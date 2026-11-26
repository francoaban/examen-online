import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, exams } from "@/lib/db/schema";

/**
 * Auditoría de foco calculada en el servidor.
 *
 * Una "salida de foco" empieza con el primer evento de pérdida (pestaña oculta,
 * ventana sin foco o cierre) y termina con el primer evento de regreso.
 * Los eventos duplicados (p. ej. `hidden` + `blur` al cambiar de pestaña) no
 * cuentan dos veces porque solo se abre una salida si no había otra en curso.
 *
 * Cada transición es un único UPDATE atómico: si llegan dos requests a la vez,
 * Postgres serializa las escrituras sobre la fila y reevalúa el CASE con el
 * valor ya actualizado, así que no hay conteos dobles.
 */

export const FOCUS_LOSS_EVENTS = new Set(["hidden", "blur", "pagehide"]);
export const FOCUS_RETURN_EVENTS = new Set(["visible", "focus"]);

export type FocusTransition = "loss" | "return";

/** Clasifica un evento del cliente. Un heartbeat con `visible: true` cierra una salida perdida. */
export function focusTransitionFor(
  type: string,
  meta?: Record<string, unknown> | null,
): FocusTransition | null {
  if (FOCUS_LOSS_EVENTS.has(type)) return "loss";
  if (FOCUS_RETURN_EVENTS.has(type)) return "return";
  if (type === "heartbeat" && meta?.visible === true) return "return";
  return null;
}

/** Abre una salida de foco si no había una en curso. Ignora intentos entregados. */
export async function recordFocusLoss(attemptId: string) {
  await db
    .update(attempts)
    .set({
      focusLossCount: sql`${attempts.focusLossCount} + case when ${attempts.focusLostSince} is null then 1 else 0 end`,
      focusLostSince: sql`coalesce(${attempts.focusLostSince}, now())`,
    })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt)));
}

/**
 * Cierra la salida de foco en curso (si la hay) en el instante `at`
 * (por defecto, la hora del servidor) y acumula su duración.
 * Suma una advertencia si duró al menos `exams.warn_after_seconds`.
 */
export async function closeFocusLoss(
  attemptId: string,
  at?: Date,
  { onlyOpenAttempts = true }: { onlyOpenAttempts?: boolean } = {},
) {
  const end = at ? sql`${at.toISOString()}::timestamptz` : sql`now()`;
  const elapsedMs = sql`greatest(0, (extract(epoch from (${end} - ${attempts.focusLostSince})) * 1000))`;
  const warnAfterMs = sql`(select ${exams.warnAfterSeconds} * 1000 from ${exams} where ${exams.id} = ${attempts.examId})`;

  await db
    .update(attempts)
    .set({
      focusLostMs: sql`${attempts.focusLostMs} + round(${elapsedMs})::int`,
      focusWarningCount: sql`${attempts.focusWarningCount} + case when ${elapsedMs} >= ${warnAfterMs} then 1 else 0 end`,
      focusLostSince: null,
    })
    .where(
      and(
        eq(attempts.id, attemptId),
        sql`${attempts.focusLostSince} is not null`,
        onlyOpenAttempts ? isNull(attempts.submittedAt) : undefined,
      ),
    );
}

/** Tiempo total fuera de foco, incluyendo la salida en curso si el intento sigue abierto. */
export function focusLostMsNow(
  attempt: { focusLostMs: number; focusLostSince: Date | null; submittedAt: Date | null },
  now: Date = new Date(),
): number {
  if (!attempt.focusLostSince || attempt.submittedAt) return attempt.focusLostMs;
  return attempt.focusLostMs + Math.max(0, now.getTime() - attempt.focusLostSince.getTime());
}
