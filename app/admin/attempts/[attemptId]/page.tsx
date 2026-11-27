import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, events, exams, questions, users } from "@/lib/db/schema";
import { finalizeIfExpired } from "@/lib/exam/attempts";
import { focusLostMsNow } from "@/lib/exam/focus";
import { requireTeacher } from "@/lib/guards";
import { formatDateTime, formatDuration, formatScore, formatTime } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { AttemptControls } from "./AttemptControls";
import { GradeForm } from "./GradeForm";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  hidden: "Cambió de pestaña / ocultó la ventana",
  visible: "Volvió a la pestaña",
  blur: "Ventana sin foco",
  focus: "Ventana con foco",
  pagehide: "Cerró o navegó fuera",
  copy: "Copió contenido",
  paste: "Pegó contenido",
  fullscreen_exit: "Salió de pantalla completa",
};

export default async function AttemptAdminPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requireTeacher();
  const { attemptId } = await params;

  const found = await db.query.attempts.findFirst({
    where: and(eq(attempts.id, attemptId), eq(attempts.isPreview, false)),
  });
  if (!found) notFound();

  const attempt = await finalizeIfExpired(found);

  const [exam, student, questionRows, answerRows, eventRows] = await Promise.all([
    db.query.exams.findFirst({ where: eq(exams.id, attempt.examId) }),
    db.query.users.findFirst({ where: eq(users.id, attempt.userId) }),
    db
      .select()
      .from(questions)
      .where(eq(questions.examId, attempt.examId))
      .orderBy(asc(questions.position)),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)),
    db
      .select()
      .from(events)
      .where(eq(events.attemptId, attemptId))
      .orderBy(desc(events.at))
      .limit(400),
  ]);

  if (!exam) notFound();

  const answersByQuestion = new Map(answerRows.map((row) => [row.questionId, row]));
  const totalPoints = questionRows.reduce((acc, q) => acc + q.points, 0);
  const submitted = attempt.submittedAt != null;

  const focusEvents = eventRows.filter(
    (row) => row.type !== "heartbeat" && row.type !== "focus",
  );
  const heartbeatCount = eventRows.filter((row) => row.type === "heartbeat").length;
  const hiddenCount = attempt.focusLossCount;
  const focusMs = focusLostMsNow(attempt);
  const awayNow = attempt.focusLostSince != null && !submitted;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href={`/admin/exams/${exam.id}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← {exam.title}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {student?.name ?? "Alumno"}
        </h1>
        <p className="text-sm text-slate-500">
          {student?.email} · Intento {attempt.attemptNumber} de {exam.maxAttempts}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={submitted ? "sky" : "amber"}>
          {submitted ? "Entregado" : "En curso"}
        </Badge>
        {attempt.status === "graded" ? (
          <Badge tone="emerald">Corrección completa</Badge>
        ) : (
          <Badge tone="slate">Corrección pendiente</Badge>
        )}
        {hiddenCount > 0 ? (
          <Badge tone="red">
            {hiddenCount} {hiddenCount === 1 ? "salida de foco" : "salidas de foco"} ·{" "}
            {formatDuration(focusMs)} fuera{awayNow ? " (fuera ahora)" : ""}
          </Badge>
        ) : (
          <Badge tone="emerald">Sin salidas de foco</Badge>
        )}
      </div>

      <Card>
        <CardHeader title="Datos del intento" />
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Inicio</dt>
              <dd className="text-slate-800">{formatDateTime(attempt.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Límite</dt>
              <dd className="text-slate-800">{formatDateTime(attempt.deadlineAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Entrega</dt>
              <dd className="text-slate-800">
                {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Nota</dt>
              <dd className="font-semibold text-slate-900">
                {submitted ? formatScore(attempt.totalScore) : "—"} /{" "}
                {formatScore(totalPoints)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Múltiple opción
              </dt>
              <dd className="text-slate-800">{formatScore(attempt.autoScore)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Desarrollo
              </dt>
              <dd className="text-slate-800">{formatScore(attempt.manualScore)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">IP</dt>
              <dd className="text-xs text-slate-600">{attempt.ip ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Señales de vida
              </dt>
              <dd className="text-slate-800">{heartbeatCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Salidas de foco
              </dt>
              <dd className="text-slate-800">{hiddenCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Tiempo fuera de foco
              </dt>
              <dd className="text-slate-800">{formatDuration(focusMs)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">
                Salidas largas (≥ {exam.warnAfterSeconds} s)
              </dt>
              <dd className="text-slate-800">
                {attempt.focusWarningCount}
                {exam.maxWarnings > 0 ? ` / ${exam.maxWarnings}` : ""}
              </dd>
            </div>
          </dl>

          <AttemptControls attemptId={attempt.id} isOpen={!submitted} />
        </CardBody>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Respuestas
        </h2>

        {questionRows.map((question, index) => {
          const answer = answersByQuestion.get(question.id);
          const options = Array.isArray(question.options) ? question.options : [];
          const isCorrect =
            question.type === "mc" &&
            question.correctOption != null &&
            answer?.selectedOption === question.correctOption;

          return (
            <Card key={question.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="indigo">Pregunta {index + 1}</Badge>
                    <Badge tone={question.type === "text" ? "sky" : "slate"}>
                      {question.type === "text" ? "A desarrollar" : "Múltiple opción"}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">
                    {question.type === "mc"
                      ? `${isCorrect ? question.points : 0} / ${question.points} pts (automático)`
                      : `máx. ${formatScore(question.points)} pts`}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {question.prompt}
                </p>

                {question.type === "mc" ? (
                  <ul className="space-y-1 text-sm">
                    {options.map((option, optionIndex) => {
                      const isStudent = answer?.selectedOption === optionIndex;
                      const isAnswer = question.correctOption === optionIndex;
                      return (
                        <li
                          key={optionIndex}
                          className={
                            isAnswer
                              ? "rounded-md bg-emerald-50 px-2 py-1 text-emerald-900"
                              : isStudent
                                ? "rounded-md bg-red-50 px-2 py-1 text-red-900"
                                : "px-2 py-1 text-slate-600"
                          }
                        >
                          {isAnswer ? "✓ " : isStudent ? "✗ " : "· "}
                          {option}
                          {isStudent ? (
                            <span className="ml-2 text-xs font-medium">(elegida)</span>
                          ) : null}
                        </li>
                      );
                    })}
                    {answer?.selectedOption == null ? (
                      <li className="px-2 text-xs text-slate-500">Sin responder</li>
                    ) : null}
                  </ul>
                ) : (
                  <div className="space-y-2">
                    <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                      {answer?.answerText?.trim() || (
                        <span className="text-slate-400">Sin responder</span>
                      )}
                    </div>
                    {question.rubric ? (
                      <p className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">
                        <span className="font-semibold">Rúbrica: </span>
                        {question.rubric}
                      </p>
                    ) : null}
                    {answer ? (
                      <GradeForm
                        attemptId={attempt.id}
                        answerId={answer.id}
                        maxPoints={question.points}
                        initialPoints={answer.pointsAwarded}
                        initialFeedback={answer.feedback}
                        disabled={!submitted}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">
                        El alumno no abrió esta pregunta, no hay respuesta para
                        puntuar.
                      </p>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Historial de foco y eventos"
          description="Marcas de tiempo del servidor. Los latidos (heartbeat) se resumen aparte."
          action={<Badge tone="slate">{focusEvents.length} eventos</Badge>}
        />
        {focusEvents.length === 0 ? (
          <CardBody>
            <Alert tone="emerald">
              No se registraron cambios de pestaña, pérdidas de foco ni cierres durante
              el examen.
            </Alert>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Hora</Th>
                <Th>Evento</Th>
                <Th>Detalle</Th>
              </tr>
            </thead>
            <tbody>
              {focusEvents.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap font-mono text-xs">
                    {formatTime(row.at)}
                  </Td>
                  <Td>
                    <span
                      className={
                        row.type === "visible"
                          ? "text-emerald-700"
                          : row.type === "hidden" || row.type === "pagehide"
                            ? "font-medium text-red-700"
                            : "text-slate-700"
                      }
                    >
                      {EVENT_LABELS[row.type] ?? row.type}
                    </span>
                  </Td>
                  <Td className="text-xs text-slate-500">
                    {row.meta &&
                    typeof row.meta === "object" &&
                    "durationMs" in row.meta
                      ? `${Math.round(Number((row.meta as { durationMs?: number }).durationMs) / 1000)} s fuera`
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div>
        <Link href={`/admin/exams/${exam.id}`}>
          <Button variant="secondary">Volver al examen</Button>
        </Link>
      </div>
    </div>
  );
}
