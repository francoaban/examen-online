import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { attempts, examStudents, exams, questions } from "@/lib/db/schema";
import {
  computeDeadline,
  finalizeIfExpired,
  listStudentAttempts,
} from "@/lib/exam/attempts";
import { getSessionUser } from "@/lib/guards";
import { fail, json, readJsonBody } from "@/lib/http";
import { startAttemptSchema } from "@/lib/api/attempt-schemas";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inicia un intento. La base garantiza dos cosas con índices únicos parciales:
 * a lo sumo un intento real abierto por alumno, y números de intento sin repetir.
 * Las vistas previas docentes no consumen intentos.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Sesión no válida. Volvé a iniciar sesión.", 401);

  const parsedBody = startAttemptSchema.safeParse(await readJsonBody(req));
  if (!parsedBody.success) return fail("Datos inválidos.", 400);

  const examId = parsedBody.data.examId;
  if (!examId) return fail("Falta el examen.", 400);
  const isPreview = parsedBody.data.preview === true;
  if (isPreview && user.role !== "teacher")
    return fail("Solo un docente puede iniciar una vista previa.", 403);

  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) return fail("El examen no existe.", 404);
  const now = new Date();
  if (!isPreview) {
    if (exam.status !== "open")
      return fail("El examen no está abierto en este momento.", 403);
    if (now < exam.opensAt)
      return fail(`El examen abre el ${formatDateTime(exam.opensAt)}.`, 403);
    if (now > exam.closesAt)
      return fail("El examen ya cerró.", 403);

    const rosterEntry = await db.query.examStudents.findFirst({
      where: and(
        eq(examStudents.examId, examId),
        eq(examStudents.email, user.email),
      ),
    });
    if (!rosterEntry)
      return fail(
        "Tu correo no está en la lista de este examen. Avisá al docente indicando el email con el que ingresaste.",
        403,
      );
  }

  const hasQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.examId, examId))
    .limit(1);
  if (hasQuestions.length === 0)
    return fail("El examen todavía no tiene preguntas cargadas.", 400);

  let attemptNumber = 1;
  if (!isPreview) {
    const previous = await listStudentAttempts(examId, user.id);

    // Un intento abierto se retoma (si venció mientras tanto, se cierra primero).
    const open = previous.find((row) => row.submittedAt == null);
    if (open) {
      const resolved = await finalizeIfExpired(open);
      if (resolved.submittedAt == null)
        return fail("Ya tenés un intento en curso.", 409, { attemptId: open.id });
    }

    if (previous.length >= exam.maxAttempts)
      return fail(
        exam.maxAttempts === 1
          ? "Ya rendiste este examen."
          : `Ya usaste los ${exam.maxAttempts} intentos permitidos.`,
        409,
        { attemptId: previous[0]?.id },
      );

    attemptNumber = (previous[0]?.attemptNumber ?? 0) + 1;
  }

  const deadlineAt = computeDeadline(exam, now, isPreview);

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ?? null;
  const userAgent = headerList.get("user-agent")?.slice(0, 300) ?? null;

  const inserted = await db
    .insert(attempts)
    .values({
      examId,
      userId: user.id,
      isPreview,
      attemptNumber,
      startedAt: now,
      deadlineAt,
      status: "in_progress",
      ip,
      userAgent,
    })
    // Si dos pestañas llegan a la vez, una gana y la otra no inserta nada.
    .onConflictDoNothing()
    .returning({ id: attempts.id });

  const attempt = inserted[0];
  if (!attempt) {
    if (isPreview)
      return fail("No se pudo iniciar la vista previa.", 409);

    const [latest] = await listStudentAttempts(examId, user.id);
    return fail("Ya tenés un intento en curso.", 409, { attemptId: latest?.id });
  }

  return json(
    { attemptId: attempt.id, attemptNumber, deadlineAt: deadlineAt.toISOString() },
    201,
  );
}
