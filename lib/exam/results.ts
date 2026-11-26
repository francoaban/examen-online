import type { Exam } from "@/lib/db/schema";

/**
 * ¿El alumno puede ver su nota?
 * - Siempre, una vez que el docente publicó las notas.
 * - Al entregar, si el examen tiene activado "Mostrar la nota al finalizar".
 *
 * El detalle pregunta por pregunta (con las respuestas correctas) sigue
 * dependiendo solo de la publicación: así no se filtran respuestas entre
 * intentos ni a compañeros que todavía no rindieron.
 */
export function canSeeScore(
  exam: Pick<Exam, "resultsPublishedAt" | "showScoreOnSubmit">,
): boolean {
  return exam.resultsPublishedAt != null || exam.showScoreOnSubmit;
}

export function canSeeAnswerDetail(exam: Pick<Exam, "resultsPublishedAt">): boolean {
  return exam.resultsPublishedAt != null;
}
