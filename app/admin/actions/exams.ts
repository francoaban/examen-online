"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { attempts, examStudents, exams, questions } from "@/lib/db/schema";
import { errorMessage, fail, ok, okWithData } from "@/lib/action-result";
import { validateExamInput } from "@/lib/exam/validators";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";
import type { ActionResult, CreateExamResult, ExamInput } from "../types";

/* -------------------------------------------------------------------------- */
/*  Exámenes                                                                   */
/* -------------------------------------------------------------------------- */

async function uniqueSlug(base: string, ignoreExamId?: string): Promise<string> {
  let candidate = base;
  for (let attempt = 2; attempt <= 60; attempt += 1) {
    const found = await db.query.exams.findFirst({
      where: eq(exams.slug, candidate),
      columns: { id: true },
    });
    if (!found || found.id === ignoreExamId) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createExam(input: ExamInput): Promise<CreateExamResult> {
  try {
    const teacher = await assertTeacher();
    const parsed = validateExamInput(input);
    if (!parsed.ok) return fail(parsed.error);

    const slug = await uniqueSlug(parsed.value.slug);

    const [created] = await db
      .insert(exams)
      .values({
        ...parsed.value,
        slug,
        status: "draft",
        createdBy: teacher.id,
      })
      .returning({ id: exams.id });
    if (!created) throw new Error("No se pudo crear el examen.");

    revalidatePath("/admin");
    return okWithData({ examId: created.id });
  } catch (error) {
    logError("admin.createExam", error);
    return fail(errorMessage(error));
  }
}

export async function saveExamSettings(
  examId: string,
  input: ExamInput,
): Promise<ActionResult> {
  try {
    await assertTeacher();
    const parsed = validateExamInput(input);
    if (!parsed.ok) return fail(parsed.error);

    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
      columns: { id: true },
    });
    if (!exam) return fail("El examen no existe.");

    const slug = await uniqueSlug(parsed.value.slug, examId);

    await db
      .update(exams)
      .set({ ...parsed.value, slug })
      .where(eq(exams.id, examId));

    // Sin límite de tiempo: los intentos abiertos vencen al nuevo cierre
    // (sin acortar prórrogas individuales ya otorgadas).
    if (parsed.value.durationMinutes == null) {
      await db
        .update(attempts)
        .set({
          deadlineAt: sql`greatest(${attempts.deadlineAt}, ${parsed.value.closesAt.toISOString()}::timestamptz)`,
        })
        .where(
          and(
            eq(attempts.examId, examId),
            eq(attempts.isPreview, false),
            isNull(attempts.submittedAt),
          ),
        );
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/exams/${examId}`);
    return ok();
  } catch (error) {
    logError("admin.saveExamSettings", error);
    return fail(errorMessage(error));
  }
}

export async function setExamStatus(
  examId: string,
  status: "draft" | "open" | "closed",
): Promise<ActionResult> {
  try {
    await assertTeacher();
    if (!["draft", "open", "closed"].includes(status))
      return fail("Estado inválido.");

    if (status === "open") {
      const rows = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.examId, examId))
        .limit(1);
      if (rows.length === 0)
        return fail("Cargá al menos una pregunta antes de abrir el examen.");
    }

    await db.update(exams).set({ status }).where(eq(exams.id, examId));
    revalidatePath("/admin");
    revalidatePath(`/admin/exams/${examId}`);
    return ok();
  } catch (error) {
    logError("admin.setExamStatus", error);
    return fail(errorMessage(error));
  }
}

export async function publishResults(
  examId: string,
  publish: boolean,
): Promise<ActionResult> {
  try {
    await assertTeacher();
    await db
      .update(exams)
      .set({ resultsPublishedAt: publish ? new Date() : null })
      .where(eq(exams.id, examId));
    revalidatePath("/admin");
    revalidatePath(`/admin/exams/${examId}`);
    return ok();
  } catch (error) {
    logError("admin.publishResults", error);
    return fail(errorMessage(error));
  }
}

export async function deleteExam(examId: string): Promise<ActionResult> {
  try {
    await assertTeacher();
    await db.delete(exams).where(eq(exams.id, examId));
    revalidatePath("/admin");
    return ok();
  } catch (error) {
    logError("admin.deleteExam", error);
    return fail(errorMessage(error));
  }
}

export async function duplicateExam(examId: string): Promise<CreateExamResult> {
  try {
    const teacher = await assertTeacher();
    const source = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });
    if (!source) return fail("El examen no existe.");

    const slug = await uniqueSlug(`${source.slug}-copia`);
    const [sourceQuestions, sourceRoster] = await Promise.all([
      db
        .select()
        .from(questions)
        .where(eq(questions.examId, source.id)),
      db
        .select()
        .from(examStudents)
        .where(eq(examStudents.examId, source.id)),
    ]);

    const created = await db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(exams)
        .values({
          slug,
          title: `${source.title.slice(0, 112)} (copia)`,
          description: source.description,
          status: "draft",
          opensAt: source.opensAt,
          closesAt: source.closesAt,
          durationMinutes: source.durationMinutes,
          maxAttempts: source.maxAttempts,
          shuffleQuestions: source.shuffleQuestions,
          shuffleOptions: source.shuffleOptions,
          warnAfterSeconds: source.warnAfterSeconds,
          maxWarnings: source.maxWarnings,
          showScoreOnSubmit: source.showScoreOnSubmit,
          createdBy: teacher.id,
        })
        .returning({ id: exams.id });
      if (!copy) throw new Error("No se pudo crear el examen duplicado.");

      if (sourceQuestions.length > 0) {
        await tx.insert(questions).values(
          sourceQuestions.map((question) => ({
            examId: copy.id,
            position: question.position,
            type: question.type,
            prompt: question.prompt,
            points: question.points,
            options: question.options,
            correctOption: question.correctOption,
            rubric: question.rubric,
          })),
        );
      }

      if (sourceRoster.length > 0) {
        await tx.insert(examStudents).values(
          sourceRoster.map((entry) => ({
            examId: copy.id,
            email: entry.email,
          })),
        );
      }

      return copy;
    });

    revalidatePath("/admin");
    return okWithData({ examId: created.id });
  } catch (error) {
    logError("admin.duplicateExam", error);
    return fail(errorMessage(error));
  }
}
