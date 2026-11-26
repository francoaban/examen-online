"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { errorMessage, fail, ok } from "@/lib/action-result";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";
import type { ActionResult } from "../types";

export async function extendTime(
  attemptId: string,
  minutes: number,
): Promise<ActionResult> {
  try {
    await assertTeacher();
    const delta = Math.round(Number(minutes));
    if (!Number.isFinite(delta) || delta < 1 || delta > 120)
      return { ok: false, error: "Los minutos deben estar entre 1 y 120." };

    const attempt = await db.query.attempts.findFirst({
      where: and(eq(attempts.id, attemptId), eq(attempts.isPreview, false)),
    });
    if (!attempt) return { ok: false, error: "El intento no existe." };
    if (attempt.submittedAt != null)
      return { ok: false, error: "El intento ya fue entregado." };

    const newDeadline = new Date(attempt.deadlineAt.getTime() + delta * 60_000);
    await db
      .update(attempts)
      .set({ deadlineAt: newDeadline })
      .where(eq(attempts.id, attemptId));

    revalidatePath(`/admin/exams/${attempt.examId}`);
    revalidatePath(`/admin/attempts/${attemptId}`);
    return ok();
  } catch (error) {
    logError("admin.extendTime", error);
    return fail(errorMessage(error));
  }
}

export async function resetAttempt(attemptId: string): Promise<ActionResult> {
  try {
    await assertTeacher();
    const attempt = await db.query.attempts.findFirst({
      where: and(eq(attempts.id, attemptId), eq(attempts.isPreview, false)),
      columns: { examId: true },
    });
    if (!attempt) return { ok: false, error: "El intento no existe." };

    await db
      .delete(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.isPreview, false)));

    revalidatePath(`/admin/exams/${attempt.examId}`);
    return ok();
  } catch (error) {
    logError("admin.resetAttempt", error);
    return fail(errorMessage(error));
  }
}
