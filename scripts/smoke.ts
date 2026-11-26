/**
 * Smoke test de la lógica de examen contra una base real.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/smoke.ts
 *
 * Crea datos con un slug único y los borra al final (cascade).
 * No toca datos existentes.
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  answers,
  attempts,
  examStudents,
  exams,
  questions,
  users,
} from "../lib/db/schema";
import { buildStudentExam } from "../lib/exam/queries";
import {
  computeAutoScore,
  computeManualScore,
  isFullyGraded,
} from "../lib/exam/scoring";
import { finalizeAttempt, recalcAttempt } from "../lib/exam/attempts";
import type { Question } from "../lib/db/schema";

const stamp = Date.now();
let passed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function baseQuestion(overrides: Partial<Question>): Question {
  return {
    id: `q-${Math.random().toString(36).slice(2)}`,
    examId: "exam",
    position: 0,
    type: "mc",
    prompt: "pregunta",
    points: 1,
    options: [],
    correctOption: null,
    rubric: null,
    ...overrides,
  };
}

async function main() {
  console.log("\n[1] Mezclado determinístico y no filtración de respuestas");
  const questionRows = [
    baseQuestion({
      id: "q-mc",
      position: 0,
      type: "mc",
      prompt: "¿Cuál es correcta?",
      points: 2,
      options: ["a", "b", "c", "d"],
      correctOption: 2,
    }),
    baseQuestion({
      id: "q-text",
      position: 1,
      type: "text",
      prompt: "Explicá",
      points: 3,
      rubric: "rúbrica secreta",
    }),
  ];

  const config = { shuffleQuestions: true, shuffleOptions: true };
  const first = buildStudentExam(config, questionRows, "attempt-1");
  const again = buildStudentExam(config, questionRows, "attempt-1");
  assert.deepEqual(first, again);
  ok("el mismo intento produce siempre el mismo orden");

  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("correctOption"), false);
  assert.equal(serialized.includes("rúbrica secreta"), false);
  ok("no se envía la opción correcta ni la rúbrica al cliente");

  const mc = first.questions.find((q) => q.id === "q-mc");
  assert.ok(mc);
  assert.deepEqual(
    mc.options.map((o) => o.index).sort((a, b) => a - b),
    [0, 1, 2, 3],
  );
  ok("las opciones conservan sus índices originales al permutarse");

  const orders = new Set(
    Array.from({ length: 8 }, (_, i) =>
      buildStudentExam(config, questionRows, `attempt-${i}`)
        .questions.map((q) => q.id)
        .join(","),
    ),
  );
  assert.ok(orders.size > 1);
  ok("intentos distintos reciben órdenes distintos");

  console.log("\n[2] Corrección automática");
  const answerRows = [
    { questionId: "q-mc", selectedOption: 2 },
    { questionId: "q-text", selectedOption: null },
  ].map((row) => ({
    id: "a",
    attemptId: "t",
    questionId: row.questionId,
    selectedOption: row.selectedOption,
    answerText: null,
    pointsAwarded: null,
    feedback: null,
    updatedAt: new Date(),
  }));

  assert.equal(computeAutoScore(questionRows, answerRows), 2);
  ok("múltiple opción correcta suma sus puntos");

  const mcAnswer = answerRows[0];
  const textAnswer = answerRows[1];
  assert.ok(mcAnswer);
  assert.ok(textAnswer);
  assert.equal(
    computeAutoScore(questionRows, [
      { ...mcAnswer, selectedOption: 1 },
    ]),
    0,
  );
  ok("opción incorrecta no suma");

  assert.equal(isFullyGraded(questionRows, answerRows), false);
  ok("el intento no está corregido si falta el desarrollo");

  const withManual = [
    { ...mcAnswer },
    { ...textAnswer, pointsAwarded: 2.5, feedback: "bien" },
  ];
  assert.equal(computeManualScore(withManual), 2.5);
  assert.equal(isFullyGraded(questionRows, withManual), true);
  ok("puntaje manual y estado de corrección completa");

  console.log("\n[3] Base de datos: intento único y consolidación");
  const [user] = await db
    .insert(users)
    .values({ googleSub: `smoke-${stamp}`, email: `smoke-${stamp}@test.local`, name: "Smoke" })
    .returning();
  assert.ok(user);

  const [exam] = await db
    .insert(exams)
    .values({
      slug: `smoke-${stamp}`,
      title: "Smoke test",
      opensAt: new Date(Date.now() - 3600_000),
      closesAt: new Date(Date.now() + 3600_000),
      durationMinutes: 30,
      shuffleQuestions: true,
      shuffleOptions: true,
      createdBy: user.id,
    })
    .returning();
  assert.ok(exam);

  await db.insert(examStudents).values({ examId: exam.id, email: user.email });

  const insertedQuestions = await db
    .insert(questions)
    .values([
      {
        examId: exam.id,
        position: 0,
        type: "mc",
        prompt: "2 + 2",
        points: 4,
        options: ["3", "4", "5"],
        correctOption: 1,
      },
      {
        examId: exam.id,
        position: 1,
        type: "text",
        prompt: "Explicá",
        points: 6,
        rubric: "criterio",
      },
    ])
    .returning({ id: questions.id });
  const mcQuestion = insertedQuestions[0];
  const textQuestion = insertedQuestions[1];
  assert.ok(mcQuestion);
  assert.ok(textQuestion);
  const { id: mcId } = mcQuestion;
  const { id: textId } = textQuestion;

  const deadline = new Date(Date.now() + 30 * 60_000);
  const firstInsert = await db
    .insert(attempts)
    .values({ examId: exam.id, userId: user.id, deadlineAt: deadline })
    .onConflictDoNothing()
    .returning({ id: attempts.id });
  assert.equal(firstInsert.length, 1);
  const firstAttempt = firstInsert[0];
  assert.ok(firstAttempt);
  ok("el primer intento se crea");

  const secondInsert = await db
    .insert(attempts)
    .values({ examId: exam.id, userId: user.id, deadlineAt: deadline })
    .onConflictDoNothing()
    .returning({ id: attempts.id });
  assert.equal(secondInsert.length, 0);
  ok("el segundo intento se rechaza en silencio (onConflictDoNothing)");

  let threw = false;
  try {
    await db
      .insert(attempts)
      .values({ examId: exam.id, userId: user.id, deadlineAt: deadline });
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  ok("sin onConflictDoNothing, la base lanza el error de unicidad");

  const attemptId = firstAttempt.id;
  await db.insert(answers).values([
    { attemptId, questionId: mcId, selectedOption: 1 },
    { attemptId, questionId: textId, answerText: "porque sí" },
  ]);

  let result = await finalizeAttempt(attemptId);
  assert.equal(result?.autoScore, 4);
  assert.equal(result?.manualScore, 0);
  assert.equal(result?.totalScore, 4);
  assert.equal(result?.status, "submitted");
  ok("al enviar, la nota automática se calcula en el servidor");

  const attemptRow = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  assert.ok(attemptRow?.submittedAt, "el intento queda con submitted_at");

  const before = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  await finalizeAttempt(attemptId);
  const after = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  assert.equal(
    before?.submittedAt?.getTime(),
    after?.submittedAt?.getTime(),
  );
  ok("reenviar no mueve la hora de entrega (idempotente)");

  await db
    .update(answers)
    .set({ pointsAwarded: 5, feedback: "buena respuesta" })
    .where(eq(answers.questionId, textId));

  await recalcAttempt(attemptId);
  const graded = await db.query.attempts.findFirst({
    where: eq(attempts.id, attemptId),
  });
  assert.equal(graded?.manualScore, 5);
  assert.equal(graded?.totalScore, 9);
  assert.equal(graded?.status, "graded");
  ok("la corrección manual actualiza total y pasa a 'graded'");

  console.log("\n[4] Limpieza");
  await db.delete(exams).where(eq(exams.id, exam.id));
  await db.delete(users).where(eq(users.id, user.id));
  const leftovers = await db.query.exams.findMany({
    where: eq(exams.id, exam.id),
  });
  assert.equal(leftovers.length, 0);
  ok("borrado en cascada del examen de prueba");

  console.log(`\n${passed} verificaciones OK\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFALLO:", error);
    process.exit(1);
  });
