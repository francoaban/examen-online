import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { examStudents, exams, questions } from "@/lib/db/schema";
import {
  bestSubmittedScore,
  finalizeIfExpired,
  listStudentAttempts,
} from "@/lib/exam/attempts";
import { canSeeScore } from "@/lib/exam/results";
import { requireUser } from "@/lib/guards";
import { formatDateTime, formatScore } from "@/lib/utils";
import { StartButton } from "./StartButton";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExamIntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { examId } = await params;
  const { preview } = await searchParams;
  const user = await requireUser();
  const isPreview = preview === "1";
  if (isPreview && user.role !== "teacher") notFound();

  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) notFound();

  let usedAttempts = 0;
  let bestScore: number | null = null;
  if (!isPreview) {
    const previous = await listStudentAttempts(examId, user.id);
    usedAttempts = previous.length;
    bestScore = bestSubmittedScore(previous);

    // Un intento abierto (y no vencido) se retoma directamente.
    const open = previous.find((row) => row.submittedAt == null);
    if (open) {
      const resolved = await finalizeIfExpired(open);
      if (resolved.submittedAt == null) redirect(`/examen/attempt/${open.id}`);
    }

    // Sin intentos disponibles: se muestra la última entrega.
    const latest = previous[0];
    if (latest && usedAttempts >= exam.maxAttempts) redirect(`/resultado/${latest.id}`);
  }
  const nextAttempt = usedAttempts + 1;
  const timeLimited = exam.durationMinutes != null;

  const rosterEntry = isPreview
    ? true
    : await db.query.examStudents.findFirst({
        where: and(
          eq(examStudents.examId, examId),
          eq(examStudents.email, user.email),
        ),
      });

  if (!rosterEntry) {
    return (
      <main className="mx-auto w-full max-w-2xl space-y-4 px-5 py-12">
        <Alert tone="red" title="No estás en la lista de este examen">
          Tu correo <strong>{user.email}</strong> no figura entre los habilitados.
          Avisá al docente indicando exactamente este email.
        </Alert>
        <Link href="/mis-examenes">
          <Button variant="secondary">Volver</Button>
        </Link>
      </main>
    );
  }

  const now = new Date();
  const notOpenYet = now < exam.opensAt;
  const closed = exam.status === "closed" || now > exam.closesAt;
  const unavailable =
    !isPreview && (exam.status !== "open" || notOpenYet || closed);

  const questionRows = await db
    .select({
      id: questions.id,
      type: questions.type,
      points: questions.points,
    })
    .from(questions)
    .where(eq(questions.examId, examId));

  const mcCount = questionRows.filter((q) => q.type === "mc").length;
  const textCount = questionRows.filter((q) => q.type === "text").length;
  const totalPoints = questionRows.reduce((acc, q) => acc + q.points, 0);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-10">
      <div className="space-y-2">
        <Badge tone={isPreview ? "amber" : "indigo"}>
          {isPreview ? "Vista previa docente" : "Examen"}
        </Badge>
        <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
        {exam.description ? (
          <p className="text-slate-600">{exam.description}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader title="Condiciones del examen" />
        <CardBody className="space-y-4">
          {isPreview ? (
            <Alert tone="indigo" title="Modo de vista previa">
              Podés probar el examen aunque esté en borrador, fuera de fecha o cerrado.
              Este intento no consume rendiciones ni aparece en resultados de alumnos.
            </Alert>
          ) : null}
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Duración
              </dt>
              <dd className="font-medium text-slate-800">
                {timeLimited ? `${exam.durationMinutes} minutos` : "Sin límite de tiempo"}
              </dd>
            </div>
            {!isPreview ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Intentos
                </dt>
                <dd className="font-medium text-slate-800">
                  {usedAttempts > 0
                    ? `Vas a rendir el intento ${nextAttempt} de ${exam.maxAttempts}`
                    : exam.maxAttempts === 1
                      ? "1 intento"
                      : `${exam.maxAttempts} intentos`}
                </dd>
              </div>
            ) : null}
            {usedAttempts > 0 && canSeeScore(exam) && bestScore != null ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">
                  Mejor nota hasta ahora
                </dt>
                <dd className="font-medium text-slate-800">{formatScore(bestScore)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Preguntas
              </dt>
              <dd className="font-medium text-slate-800">
                {questionRows.length} ({mcCount} opción múltiple
                {textCount > 0 ? `, ${textCount} a desarrollar` : ""})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Puntaje total
              </dt>
              <dd className="font-medium text-slate-800">{totalPoints} puntos</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Abre
              </dt>
              <dd className="font-medium text-slate-800">
                {formatDateTime(exam.opensAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Cierra
              </dt>
              <dd className="font-medium text-slate-800">
                {formatDateTime(exam.closesAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Tu cuenta
              </dt>
              <dd className="font-medium text-slate-800">{user.email}</dd>
            </div>
          </dl>

          <Alert tone="amber" title="Leé esto antes de comenzar">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                {isPreview ? (
                  <>La vista previa no afecta el intento real de ningún alumno.</>
                ) : exam.maxAttempts === 1 ? (
                  <>Tenés un <strong>único intento</strong>: no se puede reiniciar.</>
                ) : (
                  <>
                    Tenés <strong>{exam.maxAttempts} intentos</strong> en total
                    {usedAttempts > 0 ? ` (ya usaste ${usedAttempts})` : ""}. Cada intento
                    empieza de cero y una vez comenzado cuenta aunque no lo envíes.
                  </>
                )}
              </li>
              <li>
                {timeLimited ? (
                  <>
                    El cronómetro corre desde que comenzás y <strong>no se pausa</strong>{" "}
                    aunque cierres la pestaña o te quedes sin conexión.
                  </>
                ) : (
                  <>
                    <strong>No hay límite de tiempo</strong>, pero el examen se cierra
                    automáticamente el {formatDateTime(exam.closesAt)}.
                  </>
                )}
              </li>
              <li>
                {isPreview
                  ? "La actividad de esta vista previa se excluye del historial y las estadísticas de alumnos."
                  : "Se registran la cantidad de veces y el tiempo que estés fuera de la pestaña o de la ventana del examen. Queda en el historial y el docente lo puede ver."}
              </li>
              <li>
                Tus respuestas se guardan automáticamente, pero igual enviá el examen
                {timeLimited ? " antes de que se agote el tiempo." : " cuando termines."}
              </li>
            </ul>
          </Alert>

          {unavailable ? (
            <Alert tone="slate">
              {closed
                ? "El examen ya cerró."
                : notOpenYet
                  ? `El examen abre el ${formatDateTime(exam.opensAt)}.`
                  : "El examen no está disponible en este momento."}
            </Alert>
          ) : (
            <StartButton
              examId={exam.id}
              isPreview={isPreview}
              timeLimited={timeLimited}
              attemptNumber={nextAttempt}
            />
          )}
        </CardBody>
      </Card>

      <Link
        href={isPreview ? `/admin/exams/${exam.id}` : "/mis-examenes"}
        className="inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        {isPreview ? "← Volver al examen" : "← Volver a mis exámenes"}
      </Link>
    </main>
  );
}
