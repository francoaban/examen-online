export type ExamInput = {
  title: string;
  slug: string;
  description: string;
  opensAt: string;
  closesAt: string;
  /** null = sin límite de tiempo. */
  durationMinutes: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  warnAfterSeconds: number;
  maxWarnings: number;
  /** Mostrar la nota al alumno apenas entrega. */
  showScoreOnSubmit: boolean;
};

export type QuestionInput = {
  id?: string;
  type: "mc" | "text";
  prompt: string;
  points: number;
  options: string[];
  correctOption: number | null;
  rubric: string | null;
};
