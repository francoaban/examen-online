import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { answers, attempts, exams, questions } from "@/lib/db/schema";
import { requireUser } from "@/lib/guards";
import { finalizeIfExpired } from "@/lib/exam/attempts";
import { buildStudentExam } from "@/lib/exam/queries";
import ExamRunner, { type RunnerAnswer } from "./ExamRunner";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
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
  if (attempt.isPreview && user.role !== "teacher") notFound();

  // Si el tiempo venció mientras la pestaña estaba cerrada, se cierra acá.
  const resolved = await finalizeIfExpired(attempt);
  if (resolved.submittedAt != null) redirect(`/resultado/${attemptId}`);

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, resolved.examId),
  });
  if (!exam) notFound();

  const [questionRows, answerRows] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(eq(questions.examId, exam.id))
      .orderBy(asc(questions.position)),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)),
  ]);

  if (questionRows.length === 0) notFound();

  const { questions: studentQuestions } = buildStudentExam(
    exam,
    questionRows,
    attemptId,
  );

  const initialAnswers: Record<string, RunnerAnswer> = {};
  for (const row of answerRows) {
    initialAnswers[row.questionId] = {
      selectedOption: row.selectedOption,
      answerText: row.answerText,
    };
  }

  return (
    <ExamRunner
      attemptId={attemptId}
      examTitle={exam.title}
      deadlineAt={resolved.deadlineAt.toISOString()}
      serverNow={new Date().toISOString()}
      timeLimited={exam.durationMinutes != null}
      attemptNumber={resolved.attemptNumber}
      maxAttempts={exam.maxAttempts}
      initialFocusLosses={resolved.focusLossCount}
      initialWarnings={resolved.focusWarningCount}
      questions={studentQuestions}
      initialAnswers={initialAnswers}
      warnAfterSeconds={exam.warnAfterSeconds}
      maxWarnings={exam.maxWarnings}
      isPreview={attempt.isPreview}
    />
  );
}
