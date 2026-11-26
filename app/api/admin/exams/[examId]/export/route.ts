import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { attempts, exams, users } from "@/lib/db/schema";
import { focusLostMsNow } from "@/lib/exam/focus";
import { getSessionUser } from "@/lib/guards";
import { fail } from "@/lib/http";
import { serializeCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  in_progress: "En curso",
  submitted: "Entregado",
  graded: "Corregido",
};

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

  const attemptRows = await db
    .select({ attempt: attempts, name: users.name, email: users.email })
    .from(attempts)
    .innerJoin(users, eq(users.id, attempts.userId))
    .where(and(eq(attempts.examId, examId), eq(attempts.isPreview, false)))
    .orderBy(asc(users.email), asc(attempts.attemptNumber));

  const now = new Date();
  const rows = [
    [
      "Nombre",
      "Email",
      "Intento",
      "Inicio",
      "Entrega",
      "Nota total",
      "Nota opción múltiple",
      "Nota desarrollo",
      "Estado",
      "Salidas de foco",
      "Tiempo fuera de foco (s)",
      "Salidas largas",
    ],
    ...attemptRows.map(({ attempt, name, email }) => [
      name ?? "",
      email,
      attempt.attemptNumber,
      attempt.startedAt.toISOString(),
      attempt.submittedAt ? attempt.submittedAt.toISOString() : "",
      attempt.submittedAt ? attempt.totalScore : "",
      attempt.submittedAt ? attempt.autoScore : "",
      attempt.submittedAt ? attempt.manualScore : "",
      statusLabels[attempt.status] ?? attempt.status,
      attempt.focusLossCount,
      Math.round(focusLostMsNow(attempt, now) / 1000),
      attempt.focusWarningCount,
    ]),
  ];

  return new Response(`\uFEFF${serializeCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultados-${examId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
