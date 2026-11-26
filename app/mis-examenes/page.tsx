import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, examStudents, exams, type Attempt } from "@/lib/db/schema";
import { requireUser } from "@/lib/guards";
import { bestSubmittedScore, isPastDeadline } from "@/lib/exam/attempts";
import { canSeeScore } from "@/lib/exam/results";
import { SignOutForm } from "@/components/SignOutForm";
import { formatDateTime, formatExamDuration, formatScore } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MisExamenesPage() {
  const user = await requireUser();
  const now = new Date();

  const examRows = await db
    .select({ exam: exams })
    .from(examStudents)
    .innerJoin(exams, eq(exams.id, examStudents.examId))
    .where(and(eq(examStudents.email, user.email), ne(exams.status, "draft")))
    .orderBy(desc(exams.opensAt));

  const examIds = examRows.map((row) => row.exam.id);
  const attemptRows =
    examIds.length > 0
      ? await db
          .select()
          .from(attempts)
          .where(
            and(
              inArray(attempts.examId, examIds),
              eq(attempts.userId, user.id),
              eq(attempts.isPreview, false),
            ),
          )
          .orderBy(desc(attempts.attemptNumber))
      : [];

  const attemptsByExam = new Map<string, Attempt[]>();
  for (const row of attemptRows) {
    const list = attemptsByExam.get(row.examId) ?? [];
    list.push(row);
    attemptsByExam.set(row.examId, list);
  }

  const rows = examRows.map(({ exam }) => {
    const history = attemptsByExam.get(exam.id) ?? [];
    return { exam, history, attempt: history[0] ?? null };
  });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">Sesión iniciada como</p>
          <h1 className="text-2xl font-bold text-slate-900">
            {user.name ?? "Alumno"}
          </h1>
          <p className="text-sm font-medium text-indigo-700">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "teacher" ? (
            <Link href="/admin">
              <Button variant="secondary" size="sm">
                Panel docente
              </Button>
            </Link>
          ) : null}
          <SignOutForm>
            <Button variant="ghost" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </SignOutForm>
        </div>
      </header>

      <Alert tone="sky" title="¿No aparece tu examen?">
        Verificá que el correo de arriba sea exactamente el que el docente cargó en
        la lista. Si hay un error, avisale indicando este email.
      </Alert>

      {rows.length === 0 ? (
        <EmptyState title="Todavía no tenés exámenes asignados">
          Cuando el docente te agregue a la lista de un examen, va a aparecer acá.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ exam, attempt, history }) => {
            const closed = exam.status === "closed" || now > exam.closesAt;
            const notOpenYet = now < exam.opensAt;
            const expired = attempt
              ? attempt.submittedAt == null && isPastDeadline(attempt)
              : false;
            const finished = attempt != null && (attempt.submittedAt != null || expired);
            const available = exam.status === "open" && !closed && !notOpenYet;
            const canRetry =
              finished && available && history.length < exam.maxAttempts;
            const bestScore = bestSubmittedScore(history);

            let badge = <Badge>Borrador</Badge>;
            let action: React.ReactNode = null;

            if (attempt?.submittedAt) {
              badge =
                attempt.status === "graded" ? (
                  <Badge tone="emerald">Corregido</Badge>
                ) : (
                  <Badge tone="sky">Enviado</Badge>
                );
              action = (
                <Link href={`/resultado/${attempt.id}`}>
                  <Button size="sm" variant="secondary">
                    Ver entrega
                  </Button>
                </Link>
              );
            } else if (attempt && expired) {
              badge = <Badge tone="amber">Tiempo agotado</Badge>;
              action = (
                <Link href={`/resultado/${attempt.id}`}>
                  <Button size="sm" variant="secondary">
                    Ver entrega
                  </Button>
                </Link>
              );
            } else if (attempt) {
              badge = <Badge tone="amber">En curso</Badge>;
              action = (
                <Link href={`/examen/attempt/${attempt.id}`}>
                  <Button size="sm">Continuar</Button>
                </Link>
              );
            } else if (closed) {
              badge = <Badge>Cerrado</Badge>;
            } else if (notOpenYet) {
              badge = <Badge tone="indigo">Programado</Badge>;
            } else if (exam.status === "open") {
              badge = <Badge tone="emerald">Disponible</Badge>;
              action = (
                <Link href={`/examen/${exam.id}`}>
                  <Button size="sm">Comenzar</Button>
                </Link>
              );
            }

            return (
              <li key={exam.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {exam.title}
                      </h2>
                      {badge}
                    </div>

                    {exam.description ? (
                      <p className="text-sm text-slate-600">{exam.description}</p>
                    ) : null}

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          Duración
                        </dt>
                        <dd>{formatExamDuration(exam.durationMinutes)}</dd>
                      </div>
                      {exam.maxAttempts > 1 ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-400">
                            Intentos
                          </dt>
                          <dd>
                            {history.length} de {exam.maxAttempts} usados
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          Abre
                        </dt>
                        <dd>{formatDateTime(exam.opensAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          Cierra
                        </dt>
                        <dd>{formatDateTime(exam.closesAt)}</dd>
                      </div>
                      {bestScore != null && canSeeScore(exam) ? (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-slate-400">
                            {history.length > 1 ? "Mejor nota" : "Nota"}
                            {exam.resultsPublishedAt ? "" : " (provisoria)"}
                          </dt>
                          <dd className="font-semibold text-slate-900">
                            {formatScore(bestScore)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {attempt?.submittedAt && !canSeeScore(exam) ? (
                      <p className="text-xs text-slate-500">
                        Entregado el {formatDateTime(attempt.submittedAt)}. La nota se
                        publica cuando el docente termina la corrección.
                      </p>
                    ) : null}

                    {action || canRetry ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {action}
                        {canRetry ? (
                          <Link href={`/examen/${exam.id}`}>
                            <Button size="sm">
                              Rendir de nuevo (intento {history.length + 1} de{" "}
                              {exam.maxAttempts})
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-slate-400">
        La cantidad de intentos y el tiempo de cada examen los define el docente.
        Si el examen tiene tiempo límite, el cronómetro no se detiene al cerrar la
        pestaña.
      </p>
    </main>
  );
}
