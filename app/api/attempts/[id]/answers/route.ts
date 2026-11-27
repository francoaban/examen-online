import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, questions } from "@/lib/db/schema";
import { getActiveSessionUser } from "@/lib/guards";
import { fail, json, readJsonBody } from "@/lib/http";
import { finalizeAttempt, isPastDeadline } from "@/lib/exam/attempts";
import { saveAnswerSchema } from "@/lib/api/attempt-schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await ctx.params;

  const user = await getActiveSessionUser();
  if (!user) return fail("Sesión no válida.", 401);

  const attempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)),
  });
  if (!attempt) return fail("Intento inexistente.", 404);

  if (attempt.submittedAt != null)
    return fail("El examen ya fue enviado.", 409, { submitted: true });

  if (isPastDeadline(attempt)) {
    await finalizeAttempt(attempt.id);
    return fail("El tiempo del examen terminó.", 409, { submitted: true });
  }

  const parsedBody = saveAnswerSchema.safeParse(await readJsonBody(req));
  if (!parsedBody.success) return fail("Datos inválidos.", 400);

  const body = parsedBody.data;
  const questionId = body.questionId;
  if (!questionId) return fail("Falta la pregunta.", 400);

  const question = await db.query.questions.findFirst({
    where: and(eq(questions.id, questionId), eq(questions.examId, attempt.examId)),
  });
  if (!question) return fail("La pregunta no pertenece a este examen.", 400);

  let selectedOption: number | null = null;
  let answerText: string | null = null;

  if (question.type === "mc") {
    const optionCount = Array.isArray(question.options) ? question.options.length : 0;
    const value = body.selectedOption;
    if (value == null) {
      selectedOption = null;
    } else if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0 ||
      value >= optionCount
    ) {
      return fail("Opción inválida.", 400);
    } else {
      selectedOption = value;
    }
  } else {
    const value = typeof body.answerText === "string" ? body.answerText : "";
    answerText = value.slice(0, MAX_TEXT_LENGTH);
  }

  await db
    .insert(answers)
    .values({
      attemptId: attempt.id,
      questionId,
      selectedOption,
      answerText,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [answers.attemptId, answers.questionId],
      set: {
        selectedOption,
        answerText,
        updatedAt: new Date(),
      },
    });

  const remainingMs = Math.max(0, attempt.deadlineAt.getTime() - Date.now());

  return json({
    ok: true,
    savedAt: new Date().toISOString(),
    remainingMs,
  });
}
