import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, exams, questions } from "@/lib/db/schema";
import { requireUser } from "@/lib/guards";
import { finalizeIfExpired, listStudentAttempts } from "@/lib/exam/attempts";
import { canSeeAnswerDetail, canSeeScore } from "@/lib/exam/results";
import { formatDateTime, formatDuration, formatScore } from "@/lib/utils";
import { SignOutForm } from "@/components/SignOutForm";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const user = await requireUser();

  const attempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)),
  });
  if (!attempt) notFound();
  if (attempt.isPreview) {
    if (user.role !== "teacher") notFound();
    redirect(`/admin/exams/${attempt.examId}`);
  }

  const resolved = await finalizeIfExpired(attempt);
  if (resolved.submittedAt == null) redirect(`/examen/attempt/${attemptId}`);

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, resolved.examId),
  });
  if (!exam) notFound();

  const [questionRows, answerRows, history] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.examId, exam.id))
      .orderBy(asc(questions.position)),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)),
    listStudentAttempts(exam.id, user.id),
  ]);

  const focusCount = resolved.focusLossCount;
  const now = new Date();
  const canRetry =
    history.length < exam.maxAttempts &&
    history.every((row) => row.submittedAt != null) &&
    exam.status === "open" &&
    now >= exam.opensAt &&
    now <= exam.closesAt;
  const answersByQuestion = new Map(answerRows.map((a) => [a.questionId, a]));
  const showScore = canSeeScore(exam);
  const published = canSeeAnswerDetail(exam);
  const totalPoints = questionRows.reduce((acc, q) => acc + q.points, 0);
  // Preguntas a desarrollar todavía sin corregir (la nota es parcial mientras haya).
  const pendingManual = questionRows.filter(
    (q) => q.type === "text" && answersByQuestion.get(q.id)?.pointsAwarded == null,
  ).length;
  const answeredQuestions = questionRows.filter((q) => {
    const answer = answersByQuestion.get(q.id);
    if (!answer) return false;
    return q.type === "mc"
      ? answer.selectedOption != null
      : (answer.answerText ?? "").trim().length > 0;
  }).length;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10">
      <div className="space-y-2">
        <Badge tone="emerald">Examen enviado</Badge>
        <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
        <p className="text-sm text-slate-600">
          {exam.maxAttempts > 1
            ? `Intento ${resolved.attemptNumber} de ${exam.maxAttempts} · `
            : ""}
          Entrega registrada el {formatDateTime(resolved.submittedAt)} ·{" "}
          {answeredQuestions} de {questionRows.length} preguntas respondidas.
        </p>
      </div>

      {focusCount > 0 ? (
        <Alert
          tone={
            exam.maxWarnings > 0 && resolved.focusWarningCount >= exam.maxWarnings
              ? "red"
              : "amber"
          }
        >
          Se registraron <strong>{focusCount}</strong>{" "}
          {focusCount === 1 ? "salida" : "salidas"} de la pestaña o pérdidas de foco,
          con un total de <strong>{formatDuration(resolved.focusLostMs)}</strong> fuera
          del examen. Quedan en el historial para el docente.
        </Alert>
      ) : null}

      {canRetry ? (
        <Alert tone="indigo" title="Podés volver a rendir">
          <div className="space-y-2">
            <p>
              Usaste {history.length} de {exam.maxAttempts} intentos. El nuevo intento
              empieza de cero.
            </p>
            <Link href={`/examen/${exam.id}`}>
              <Button size="sm">Rendir intento {history.length + 1}</Button>
            </Link>
          </div>
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Resultado" />
        <CardBody>
          {showScore ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {pendingManual > 0
                  ? "Nota parcial"
                  : "Puntaje obtenido"}{" "}
                sobre {formatScore(totalPoints)} puntos posibles.
              </p>
              <p className="text-4xl font-bold text-slate-900">
                {formatScore(resolved.totalScore)}
                <span className="ml-1 text-base font-normal text-slate-400">
                  / {formatScore(totalPoints)}
                </span>
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="sky">
                  Múltiple opción: {formatScore(resolved.autoScore)}
                </Badge>
                <Badge tone="indigo">
                  Desarrollo: {formatScore(resolved.manualScore)}
                </Badge>
                {resolved.status === "graded" ? (
                  <Badge tone="emerald">Corrección completa</Badge>
                ) : (
                  <Badge tone="amber">Corrección en curso</Badge>
                )}
              </div>
              {pendingManual > 0 ? (
                <p className="text-xs text-slate-500">
                  {pendingManual === 1
                    ? "Falta corregir 1 pregunta a desarrollar"
                    : `Faltan corregir ${pendingManual} preguntas a desarrollar`}
                  : la nota puede subir cuando el docente las corrija.
                </p>
              ) : null}
              {!published ? (
                <p className="text-xs text-slate-500">
                  El detalle con las respuestas correctas se ve cuando el docente publique
                  las notas.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Tu examen quedó guardado y cerrado. La nota se publica cuando el
                docente termina la corrección.
              </p>
              <p className="text-xs text-slate-500">
                Guardá este enlace para volver a consultar el resultado.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {published ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Detalle
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
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge tone="indigo">Pregunta {index + 1}</Badge>
                    <span className="text-xs text-slate-500">
                      {formatScore(answer?.pointsAwarded ?? (isCorrect ? question.points : 0))}{" "}
                      / {formatScore(question.points)} pts
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-medium text-slate-900">
                    {question.prompt}
                  </p>

                  {question.type === "mc" ? (
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-600">
                        Tu respuesta:{" "}
                        <span
                          className={
                            isCorrect ? "font-medium text-emerald-700" : "font-medium text-red-700"
                          }
                        >
                          {answer?.selectedOption != null
                            ? (options[answer.selectedOption] ?? "—")
                            : "Sin responder"}
                        </span>
                      </p>
                      {!isCorrect && question.correctOption != null ? (
                        <p className="text-slate-600">
                          Correcta:{" "}
                          <span className="font-medium text-emerald-700">
                            {options[question.correctOption] ?? "—"}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <p className="whitespace-pre-wrap text-slate-700">
                        {answer?.answerText?.trim() || "Sin responder"}
                      </p>
                      {answer?.feedback ? (
                        <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">
                          <span className="font-medium">Devolución: </span>
                          {answer.feedback}
                        </p>
                      ) : null}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link href="/mis-examenes">
          <Button variant="secondary">Volver a mis exámenes</Button>
        </Link>
        <SignOutForm>
          <Button variant="ghost" type="submit">
            Cerrar sesión
          </Button>
        </SignOutForm>
      </div>
    </main>
  );
}
