import assert from "node:assert/strict";
import test from "node:test";
import type { AnswerRow, Question } from "../lib/db/schema";
import { buildStudentExam } from "../lib/exam/queries";
import {
  computeAutoScore,
  computeManualScore,
  isFullyGraded,
} from "../lib/exam/scoring";
import { validateExamInput } from "../lib/exam/validators";
import type { ExamInput } from "../lib/exam/types";

const validExam: ExamInput = {
  title: "  Examen de prueba  ",
  slug: "",
  description: "",
  opensAt: "2026-10-01T10:00",
  closesAt: "2026-10-01T11:00",
  durationMinutes: 30,
  maxAttempts: 1,
  shuffleQuestions: true,
  shuffleOptions: true,
  warnAfterSeconds: 10,
  maxWarnings: 3,
  showScoreOnSubmit: false,
};

function question(overrides: Partial<Question>): Question {
  return {
    id: "question-mc",
    examId: "exam",
    position: 0,
    type: "mc",
    prompt: "Pregunta de prueba",
    points: 2,
    options: ["incorrecta", "correcta", "otra"],
    correctOption: 1,
    rubric: null,
    ...overrides,
  };
}

function answer(
  questionId: string,
  overrides: Partial<AnswerRow> = {},
): AnswerRow {
  return {
    id: `answer-${questionId}`,
    attemptId: "attempt",
    questionId,
    selectedOption: null,
    answerText: null,
    pointsAwarded: null,
    feedback: null,
    updatedAt: new Date(0),
    ...overrides,
  };
}

test("validates and normalizes exam input without a database", () => {
  const result = validateExamInput(validExam);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.title, "Examen de prueba");
  assert.equal(result.value.durationMinutes, 30);
});

test("builds a deterministic student view without answer keys", () => {
  const questionRows = [
    question({ id: "question-mc", position: 0 }),
    question({
      id: "question-text",
      position: 1,
      type: "text",
      prompt: "Desarrollá la respuesta",
      points: 3,
      correctOption: null,
      options: [],
      rubric: "Rúbrica privada",
    }),
  ];
  const config = { shuffleQuestions: true, shuffleOptions: true };

  const first = buildStudentExam(config, questionRows, "attempt-123");
  const second = buildStudentExam(config, questionRows, "attempt-123");
  assert.deepEqual(first, second);

  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("correctOption"), false);
  assert.equal(serialized.includes("Rúbrica privada"), false);

  const multipleChoice = first.questions.find((row) => row.id === "question-mc");
  assert.ok(multipleChoice);
  assert.deepEqual(
    multipleChoice.options.map((option) => option.index).sort((a, b) => a - b),
    [0, 1, 2],
  );
});

test("scores objective answers and reports manual grading completion", () => {
  const questionRows = [
    question({ id: "question-mc", type: "mc", points: 2, correctOption: 1 }),
    question({
      id: "question-text",
      position: 1,
      type: "text",
      points: 3,
      correctOption: null,
      options: [],
    }),
  ];
  const correctAnswer = answer("question-mc", { selectedOption: 1 });
  const textAnswer = answer("question-text", { answerText: "Respuesta" });

  assert.equal(computeAutoScore(questionRows, [correctAnswer, textAnswer]), 2);
  assert.equal(
    computeAutoScore(questionRows, [
      { ...correctAnswer, selectedOption: 0 },
      textAnswer,
    ]),
    0,
  );
  assert.equal(isFullyGraded(questionRows, [correctAnswer, textAnswer]), false);

  const gradedText = { ...textAnswer, pointsAwarded: 2.5, feedback: "Bien" };
  assert.equal(computeManualScore([gradedText]), 2.5);
  assert.equal(
    isFullyGraded(questionRows, [correctAnswer, gradedText]),
    true,
  );
  assert.equal(isFullyGraded([questionRows[0]!], [correctAnswer]), true);
});
