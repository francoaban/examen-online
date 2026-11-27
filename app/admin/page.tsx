import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/guards";
import { attempts, examStudents, exams, questions } from "@/lib/db/schema";
import { formatDateTime, formatExamDuration } from "@/lib/utils";
import { Alert, Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const statusTone = {
  draft: "slate",
  open: "emerald",
  closed: "amber",
} as const;

const statusLabel = {
  draft: "Borrador",
  open: "Abierto",
  closed: "Cerrado",
} as const;

export default async function AdminHomePage() {
  await requireTeacher();
  const examList = await db.select().from(exams).orderBy(desc(exams.createdAt));

  const [questionCounts, rosterCounts, attemptCounts] = await Promise.all([
    db
      .select({ examId: questions.examId, total: sql<number>`count(*)::int` })
      .from(questions)
      .groupBy(questions.examId),
    db
      .select({ examId: examStudents.examId, total: sql<number>`count(*)::int` })
      .from(examStudents)
      .groupBy(examStudents.examId),
    db
      .select({
        examId: attempts.examId,
        total: sql<number>`count(*)::int`,
        submitted:
          sql<number>`(count(*) filter (where ${attempts.submittedAt} is not null))::int`,
      })
      .from(attempts)
      .where(eq(attempts.isPreview, false))
      .groupBy(attempts.examId),
  ]);

  const questionMap = new Map(questionCounts.map((row) => [row.examId, row.total]));
  const rosterMap = new Map(rosterCounts.map((row) => [row.examId, row.total]));
  const attemptMap = new Map(
    attemptCounts.map((row) => [row.examId, { total: row.total, submitted: row.submitted }]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exámenes</h1>
          <p className="text-sm text-slate-500">
            Creá el examen, cargá preguntas y la lista de alumnos habilitados.
          </p>
        </div>
        <Link href="/admin/exams/new">
          <Button>Nuevo examen</Button>
        </Link>
      </div>

      <Alert tone="sky" title="Orden recomendado">
        1) Crear el examen · 2) Cargar las preguntas · 3) Pegar la lista de emails ·
        4) Publicarlo con el estado <strong>Abierto</strong>.
      </Alert>

      {examList.length === 0 ? (
        <EmptyState title="Todavía no hay exámenes">
          Empezá creando el primero.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {examList.map((exam) => {
            const stats = attemptMap.get(exam.id);
            return (
              <li key={exam.id}>
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/exams/${exam.id}`}
                            className="text-lg font-semibold text-slate-900 hover:text-indigo-700"
                          >
                            {exam.title}
                          </Link>
                          <Badge tone={statusTone[exam.status as keyof typeof statusTone] ?? "slate"}>
                            {statusLabel[exam.status as keyof typeof statusLabel] ?? exam.status}
                          </Badge>
                          {exam.resultsPublishedAt ? (
                            <Badge tone="indigo">Notas publicadas</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          Abre {formatDateTime(exam.opensAt)} · cierra{" "}
                          {formatDateTime(exam.closesAt)} ·{" "}
                          {formatExamDuration(exam.durationMinutes)} ·{" "}
                          {exam.maxAttempts === 1 ? "1 intento" : `${exam.maxAttempts} intentos`}
                        </p>
                      </div>
                      <Link href={`/admin/exams/${exam.id}`}>
                        <Button size="sm" variant="secondary">
                          Administrar
                        </Button>
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span>
                        <strong className="text-slate-900">
                          {questionMap.get(exam.id) ?? 0}
                        </strong>{" "}
                        preguntas
                      </span>
                      <span>
                        <strong className="text-slate-900">
                          {rosterMap.get(exam.id) ?? 0}
                        </strong>{" "}
                        alumnos habilitados
                      </span>
                      <span>
                        <strong className="text-slate-900">{stats?.total ?? 0}</strong>{" "}
                        intentos ({stats?.submitted ?? 0} entregados)
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
