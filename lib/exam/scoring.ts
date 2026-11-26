import type { AnswerRow, Question } from "@/lib/db/schema";

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Suma de puntos de las preguntas de múltiple opción correctas. */
export function computeAutoScore(
  questions: Question[],
  answerRows: AnswerRow[],
): number {
  const byQuestion = new Map(answerRows.map((a) => [a.questionId, a]));
  let total = 0;

  for (const q of questions) {
    if (q.type !== "mc") continue;
    const answer = byQuestion.get(q.id);
    if (!answer || answer.selectedOption == null) continue;
    if (q.correctOption != null && answer.selectedOption === q.correctOption) {
      total += Number(q.points) || 0;
    }
  }

  return round2(total);
}

/** Suma de los puntajes que el docente ya asignó a las preguntas abiertas. */
export function computeManualScore(answerRows: AnswerRow[]): number {
  const total = answerRows.reduce(
    (acc, a) => acc + (a.pointsAwarded == null ? 0 : Number(a.pointsAwarded) || 0),
    0,
  );
  return round2(total);
}

/** true si todas las preguntas de desarrollo tienen puntaje asignado. */
export function isFullyGraded(
  questions: Question[],
  answerRows: AnswerRow[],
): boolean {
  const textQuestions = questions.filter((q) => q.type === "text");
  if (textQuestions.length === 0) return true;

  const byQuestion = new Map(answerRows.map((a) => [a.questionId, a]));
  return textQuestions.every((q) => {
    const answer = byQuestion.get(q.id);
    return answer != null && answer.pointsAwarded != null;
  });
}
