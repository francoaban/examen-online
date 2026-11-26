"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { answers, attempts, questions } from "@/lib/db/schema";
import { errorMessage, fail, ok } from "@/lib/action-result";
import { recalcAttempt } from "@/lib/exam/attempts";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";
import type { ActionResult, QuestionInput } from "../types";

/* -------------------------------------------------------------------------- */
/*  Preguntas                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveQuestions(
  examId: string,
  rows: QuestionInput[],
): Promise<ActionResult> {
  try {
    await assertTeacher();

    if (!Array.isArray(rows) || rows.length === 0)
      return { ok: false, error: "Cargá al menos una pregunta." };
    if (rows.length > 200) return { ok: false, error: "Máximo 200 preguntas por examen." };

    const existing = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.examId, examId));
    const existingIds = new Set(existing.map((q) => q.id));

    type Clean = {
      id?: string;
      type: "mc" | "text";
      prompt: string;
      points: number;
      options: string[];
      correctOption: number | null;
      rubric: string | null;
      position: number;
    };

    const cleaned: Clean[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row)
        return { ok: false, error: `La pregunta ${index + 1} no es válida.` };
      const prompt = (row.prompt ?? "").trim();
      if (!prompt)
        return { ok: false, error: `La pregunta ${index + 1} no tiene enunciado.` };

      const type: "mc" | "text" = row.type === "text" ? "text" : "mc";
      const points = Number(row.points);
      if (!Number.isFinite(points) || points < 0 || points > 1000)
        return { ok: false, error: `Puntaje inválido en la pregunta ${index + 1}.` };

      let options: string[] = [];
      let correctOption: number | null = null;

      if (type === "mc") {
        options = (row.options ?? [])
          .map((option) => (option ?? "").trim())
          .filter((option) => option.length > 0);

        if (options.length < 2)
          return {
            ok: false,
            error: `La pregunta ${index + 1} necesita al menos 2 opciones.`,
          };

        correctOption =
          row.correctOption == null ? null : Math.round(Number(row.correctOption));

        if (
          correctOption == null ||
          !Number.isInteger(correctOption) ||
          correctOption < 0 ||
          correctOption >= options.length
        )
          return {
            ok: false,
            error: `Marcá la opción correcta de la pregunta ${index + 1}.`,
          };
      }

      const clean: Clean = {
        type,
        prompt,
        points,
        options,
        correctOption,
        rubric: type === "text" ? (row.rubric ?? "").trim() || null : null,
        position: index,
      };
      if (row.id && existingIds.has(row.id)) clean.id = row.id;
      cleaned.push(clean);
    }

    const keepIds = new Set(
      cleaned.map((row) => row.id).filter((id): id is string => Boolean(id)),
    );
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const used = await db
        .select({ questionId: answers.questionId })
        .from(answers)
        .innerJoin(attempts, eq(attempts.id, answers.attemptId))
        .where(
          and(
            eq(attempts.examId, examId),
            eq(attempts.isPreview, false),
            inArray(answers.questionId, toDelete),
          ),
        )
        .limit(1);

      if (used.length > 0)
        return {
          ok: false,
          error:
            "No se pueden eliminar preguntas que ya tienen respuestas. Duplicá el examen si necesitás cambiar la estructura.",
        };
    }

    await db.transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx
          .delete(questions)
          .where(and(eq(questions.examId, examId), inArray(questions.id, toDelete)));
      }

      for (const row of cleaned) {
        if (row.id) {
          await tx
            .update(questions)
            .set({
              type: row.type,
              prompt: row.prompt,
              points: row.points,
              options: row.options,
              correctOption: row.correctOption,
              rubric: row.rubric,
              position: row.position,
            })
            .where(and(eq(questions.id, row.id), eq(questions.examId, examId)));
        } else {
          await tx.insert(questions).values({
            examId,
            type: row.type,
            prompt: row.prompt,
            points: row.points,
            options: row.options,
            correctOption: row.correctOption,
            rubric: row.rubric,
            position: row.position,
          });
        }
      }
    });

    // Si cambió el puntaje de algo ya rendido, se recalculan las notas.
    const submitted = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.examId, examId),
          eq(attempts.isPreview, false),
          isNotNull(attempts.submittedAt),
        ),
      )
      .limit(500);

    for (const row of submitted) {
      await recalcAttempt(row.id);
    }

    revalidatePath(`/admin/exams/${examId}`);
    return ok();
  } catch (error) {
    logError("admin.saveQuestions", error);
    return fail(errorMessage(error));
  }
}
