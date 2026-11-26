import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { attempts, exams, users } from "@/lib/db/schema";
import { focusLostMsNow } from "@/lib/exam/focus";
import { getSessionUser } from "@/lib/guards";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ examId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return fail("Sesión no válida.", 401);
  if (user.role !== "teacher") return fail("No autorizado.", 403);

  const { examId } = await context.params;
  if (!z.string().uuid().safeParse(examId).success)
    return fail("Identificador de examen inválido.", 400);

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
    columns: { id: true },
  });
  if (!exam) return fail("El examen no existe.", 404);

  const activeAttempts = await db
    .select({
      id: attempts.id,
      name: users.name,
      email: users.email,
      startedAt: attempts.startedAt,
      deadlineAt: attempts.deadlineAt,
      submittedAt: attempts.submittedAt,
      attemptNumber: attempts.attemptNumber,
      focusLossCount: attempts.focusLossCount,
      focusLostMs: attempts.focusLostMs,
      focusLostSince: attempts.focusLostSince,
    })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(
      and(
        eq(attempts.examId, examId),
        eq(attempts.isPreview, false),
        isNull(attempts.submittedAt),
      ),
    )
    .orderBy(asc(attempts.startedAt));

  const now = new Date();
  return json({
    serverNow: now.toISOString(),
    attempts: activeAttempts.map((attempt) => ({
      id: attempt.id,
      name: attempt.name,
      email: attempt.email,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: attempt.deadlineAt.toISOString(),
      focusLossCount: attempt.focusLossCount,
      focusLostMs: focusLostMsNow(attempt, now),
      awayNow: attempt.focusLostSince != null,
    })),
  });
}
