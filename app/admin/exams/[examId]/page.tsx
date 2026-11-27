import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, examStudents, exams, questions, users } from "@/lib/db/schema";
import { focusLostMsNow } from "@/lib/exam/focus";
import { requireTeacher } from "@/lib/guards";
import {
  formatDateTime,
  formatDuration,
  formatExamDuration,
  formatScore,
  toArgLocalInput,
} from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ExamForm } from "../ExamForm";
import type { ExamInput, QuestionInput } from "../../types";
import { ExamControls } from "./ExamControls";
import { LiveMonitor } from "./LiveMonitor";
import { QuestionsEditor } from "./QuestionsEditor";
import { RosterEditor } from "./RosterEditor";

export const dynamic = "force-dynamic";

const statusTone = { draft: "slate", open: "emerald", closed: "amber" } as const;
const statusLabel = { draft: "Borrador", open: "Abierto", closed: "Cerrado" } as const;

const attemptLabel: Record<string, { label: string; tone: "slate" | "amber" | "sky" | "emerald" }> = {
  in_progress: { label: "En curso", tone: "amber" },
  submitted: { label: "Entregado", tone: "sky" },
  graded: { label: "Corregido", tone: "emerald" },
};

export default async function ExamAdminPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  // El layout no alcanza como barrera: esta página envía respuestas correctas y
  // rúbricas al cliente, así que verifica el rol antes de tocar la base (SEC-01).
  await requireTeacher();
  const { examId } = await params;

  const exam = await db.query.exams.findFirst({ where: eq(exams.id, examId) });
  if (!exam) notFound();

  const [questionRows, rosterRows, attemptRows] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.examId, examId))
      .orderBy(asc(questions.position)),
    db
      .select()
      .from(examStudents)
      .where(eq(examStudents.examId, examId))
      .orderBy(asc(examStudents.email)),
    db
      .select({ attempt: attempts, email: users.email, name: users.name })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.userId))
      .where(and(eq(attempts.examId, examId), eq(attempts.isPreview, false)))
      .orderBy(desc(attempts.startedAt)),
  ]);

  const now = new Date();
  const studentsWithAttempts = new Set(attemptRows.map((row) => row.attempt.userId)).size;

  const totalPoints = questionRows.reduce((acc, q) => acc + q.points, 0);

  const initialExam: ExamInput = {
    title: exam.title,
    slug: exam.slug,
    description: exam.description ?? "",
    opensAt: toArgLocalInput(exam.opensAt),
    closesAt: toArgLocalInput(exam.closesAt),
    durationMinutes: exam.durationMinutes,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    warnAfterSeconds: exam.warnAfterSeconds,
    maxWarnings: exam.maxWarnings,
    showScoreOnSubmit: exam.showScoreOnSubmit,
  };

  const initialQuestions: QuestionInput[] = questionRows.map((q) => ({
    id: q.id,
    type: q.type === "text" ? "text" : "mc",
    prompt: q.prompt,
    points: q.points,
    options: Array.isArray(q.options) ? q.options : [],
    correctOption: q.correctOption,
    rubric: q.rubric,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
          ← Exámenes
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
          <Badge tone={statusTone[exam.status as keyof typeof statusTone] ?? "slate"}>
            {statusLabel[exam.status as keyof typeof statusLabel] ?? exam.status}
          </Badge>
          {exam.resultsPublishedAt ? <Badge tone="indigo">Notas publicadas</Badge> : null}
          {exam.showScoreOnSubmit && !exam.resultsPublishedAt ? (
            <Badge tone="sky">Nota visible al finalizar</Badge>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">
          Abre {formatDateTime(exam.opensAt)} · cierra {formatDateTime(exam.closesAt)} ·{" "}
          {formatExamDuration(exam.durationMinutes)} ·{" "}
          {exam.maxAttempts === 1 ? "1 intento" : `${exam.maxAttempts} intentos`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Preguntas", value: questionRows.length },
          { label: "Puntos", value: formatScore(totalPoints) },
          { label: "Habilitados", value: rosterRows.length },
          {
            label: "Intentos",
            value:
              exam.maxAttempts > 1
                ? `${attemptRows.length} (${studentsWithAttempts} alumnos)`
                : attemptRows.length,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardBody className="py-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="text-xl font-semibold text-slate-900">{item.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Configuración"
          description="Podés editar fechas y duración incluso con el examen abierto."
        />
        <CardBody>
          <ExamForm initial={initialExam} mode="edit" examId={exam.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Estado y publicación"
          description="Abrir el examen lo habilita para los alumnos de la lista."
        />
        <CardBody>
          <ExamControls
            examId={exam.id}
            status={exam.status}
            resultsPublished={exam.resultsPublishedAt != null}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Monitor en vivo"
          description="Intentos activos de alumnos. Se actualiza automáticamente cada 10 segundos."
        />
        <CardBody>
          <LiveMonitor examId={exam.id} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Preguntas"
          description="El orden acá es el orden base. Si está activado el mezclado, cada alumno ve otro orden."
        />
        <CardBody>
          <QuestionsEditor examId={exam.id} initial={initialQuestions} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Alumnos habilitados"
          description="Lista blanca de correos electrónicos."
          action={<Badge tone="sky">{rosterRows.length} emails</Badge>}
        />
        <CardBody>
          <RosterEditor examId={exam.id} initial={rosterRows.map((row) => row.email)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Intentos"
          description={
            exam.maxAttempts === 1
              ? "Cada alumno tiene un único intento (lo garantiza la base de datos)."
              : `Cada alumno puede rendir hasta ${exam.maxAttempts} veces; se listan todos los intentos.`
          }
        />
        {attemptRows.length === 0 ? (
          <CardBody>
            <EmptyState title="Todavía no hay intentos">
              Cuando un alumno comience el examen va a aparecer acá en tiempo real
              (recargando la página).
            </EmptyState>
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Alumno</Th>
                <Th>Intento</Th>
                <Th>Estado</Th>
                <Th>Inicio</Th>
                <Th>Límite</Th>
                <Th>Foco</Th>
                <Th>Nota</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {attemptRows.map(({ attempt, email, name }) => {
                const meta = attemptLabel[attempt.status] ?? {
                  label: attempt.status,
                  tone: "slate" as const,
                };
                const focusCount = attempt.focusLossCount;
                const focusMs = focusLostMsNow(attempt, now);
                const awayNow = attempt.focusLostSince != null && !attempt.submittedAt;
                return (
                  <tr key={attempt.id}>
                    <Td>
                      <div className="font-medium text-slate-900">{name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{email}</div>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {attempt.attemptNumber} / {exam.maxAttempts}
                    </Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatDateTime(attempt.startedAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatDateTime(attempt.deadlineAt)}
                    </Td>
                    <Td>
                      {focusCount > 0 ? (
                        <div className="space-y-0.5">
                          <Badge
                            tone={
                              exam.maxWarnings > 0 &&
                              attempt.focusWarningCount >= exam.maxWarnings
                                ? "red"
                                : "amber"
                            }
                          >
                            {focusCount} {focusCount === 1 ? "salida" : "salidas"}
                          </Badge>
                          <div className="whitespace-nowrap text-xs text-slate-500">
                            {formatDuration(focusMs)}
                            {awayNow ? " · fuera ahora" : ""}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {attempt.submittedAt ? (
                        <span className="font-medium">
                          {formatScore(attempt.totalScore)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <Link href={`/admin/attempts/${attempt.id}`}>
                        <Button size="sm" variant="secondary">
                          Ver
                        </Button>
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {exam.status === "open" && rosterRows.length === 0 ? (
        <Alert tone="amber" title="El examen está abierto pero no tiene alumnos">
          Nadie va a poder rendirlo hasta que cargues la lista de emails.
        </Alert>
      ) : null}
    </div>
  );
}
