"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { answers, attempts, questions } from "@/lib/db/schema";
import { errorMessage, fail, ok } from "@/lib/action-result";
import { recalcAttempt } from "@/lib/exam/attempts";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";
import type { ActionResult } from "../types";

/* -------------------------------------------------------------------------- */
/*  Corrección e intervenciones                                                */
/* -------------------------------------------------------------------------- */

export async function gradeAnswer(
  attemptId: string,
  answerId: string,
  points: number | null,
  feedback: string,
): Promise<ActionResult> {
  try {
    await assertTeacher();

    const answer = await db.query.answers.findFirst({
      where: eq(answers.id, answerId),
    });
    if (!answer || answer.attemptId !== attemptId)
      return { ok: false, error: "La respuesta no pertenece a este intento." };

    const attempt = await db.query.attempts.findFirst({
      where: and(eq(attempts.id, attemptId), eq(attempts.isPreview, false)),
      columns: { submittedAt: true },
    });
    if (!attempt) return { ok: false, error: "El intento no existe." };
    if (attempt.submittedAt == null)
      return { ok: false, error: "El intento todavía no fue entregado." };

    const question = await db.query.questions.findFirst({
      where: eq(questions.id, answer.questionId),
    });
    if (!question) return { ok: false, error: "La pregunta no existe." };

    let value: number | null = null;
    if (points != null) {
      const numeric = Number(points);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > question.points)
        return {
          ok: false,
          error: `El puntaje debe estar entre 0 y ${question.points}.`,
        };
      value = numeric;
    }

    await db
      .update(answers)
      .set({
        pointsAwarded: value,
        feedback: (feedback ?? "").trim() || null,
      })
      .where(eq(answers.id, answerId));

    await recalcAttempt(attemptId);
    revalidatePath(`/admin/attempts/${attemptId}`);
    return ok();
  } catch (error) {
    logError("admin.gradeAnswer", error);
    return fail(errorMessage(error));
  }
}

/** Recalcula a mano (útil si se editó una pregunta después de entregar). */
export async function recalcAllAttempts(examId: string): Promise<ActionResult> {
  try {
    await assertTeacher();
    const rows = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.examId, examId),
          eq(attempts.isPreview, false),
          isNotNull(attempts.submittedAt),
        ),
      )
      .limit(1000);

    for (const row of rows) {
      await recalcAttempt(row.id);
    }

    revalidatePath(`/admin/exams/${examId}`);
    return ok();
  } catch (error) {
    logError("admin.recalcAllAttempts", error);
    return fail(errorMessage(error));
  }
}
