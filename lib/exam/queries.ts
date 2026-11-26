import type { Exam, Question } from "@/lib/db/schema";
import { mulberry32, seedFromString, shuffleCopy } from "@/lib/exam/random";

/** Opción tal como la ve el alumno. `index` es el índice ORIGINAL. */
export type StudentOption = { index: number; text: string };

/**
 * Pregunta serializable al cliente.
 * Importante: no incluye `correctOption` ni `rubric`.
 */
export type StudentQuestion = {
  id: string;
  type: "mc" | "text";
  prompt: string;
  points: number;
  options: StudentOption[];
};

export type StudentExam = {
  questions: StudentQuestion[];
  totalPoints: number;
};

type ShuffleConfig = Pick<Exam, "shuffleQuestions" | "shuffleOptions">;

/**
 * Construye la vista del examen para un intento concreto.
 * El orden es determinístico a partir del id del intento: recargar la página
 * no cambia nada, pero dos alumnos no ven lo mismo.
 *
 * Las opciones se envían ya permutadas y cada una lleva su índice original.
 * Así el servidor corrige contra `correct_option` sin revelar nada y sin
 * necesidad de "des-permutar" del lado del cliente.
 */
export function buildStudentExam(
  exam: ShuffleConfig,
  rows: Question[],
  attemptId: string,
): StudentExam {
  const random = mulberry32(seedFromString(attemptId));

  let ordered = [...rows].sort(
    (a, b) => a.position - b.position || a.id.localeCompare(b.id),
  );

  if (exam.shuffleQuestions) {
    ordered = shuffleCopy(ordered, random);
  }

  const questions: StudentQuestion[] = ordered.map((q) => {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    let indices = rawOptions.map((_, i) => i);

    if (exam.shuffleOptions && indices.length > 1) {
      indices = shuffleCopy(indices, random);
    }

    return {
      id: q.id,
      type: q.type === "text" ? "text" : "mc",
      prompt: q.prompt,
      points: q.points,
      options: indices.map((originalIndex) => ({
        index: originalIndex,
        text: rawOptions[originalIndex] ?? "",
      })),
    };
  });

  const totalPoints = rows.reduce((acc, q) => acc + (Number(q.points) || 0), 0);

  return { questions, totalPoints };
}
