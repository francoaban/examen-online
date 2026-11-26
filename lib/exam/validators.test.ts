import assert from "node:assert/strict";
import test from "node:test";
import { validateExamInput, validateRosterEmails } from "./validators";
import type { ExamInput } from "./types";

const validExam: ExamInput = {
  title: "Examen de prueba",
  slug: "",
  description: "",
  opensAt: "2026-10-01T10:00",
  closesAt: "2026-10-01T11:00",
  durationMinutes: 30,
  maxAttempts: 1,
  shuffleQuestions: true,
  shuffleOptions: false,
  warnAfterSeconds: 30,
  maxWarnings: 3,
  showScoreOnSubmit: false,
};

test("validates and normalizes exam input", () => {
  const result = validateExamInput({ ...validExam, title: "  Examen  " });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.title, "Examen");
  assert.equal(result.value.slug, "examen");
  assert.equal(result.value.durationMinutes, 30);
  assert.equal(result.value.opensAt.toISOString(), "2026-10-01T13:00:00.000Z");
});

test("rejects short titles, invalid date order, and out-of-range durations", () => {
  assert.equal(validateExamInput({ ...validExam, title: "ab" }).ok, false);
  assert.equal(
    validateExamInput({
      ...validExam,
      closesAt: "2026-10-01T10:00",
    }).ok,
    false,
  );
  assert.equal(
    validateExamInput({ ...validExam, durationMinutes: 601 }).ok,
    false,
  );
});

test("accepts exams without a time limit", () => {
  const result = validateExamInput({ ...validExam, durationMinutes: null });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.durationMinutes, null);
});

test("validates the number of allowed attempts", () => {
  const result = validateExamInput({ ...validExam, maxAttempts: 3 });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.maxAttempts, 3);

  assert.equal(validateExamInput({ ...validExam, maxAttempts: 0 }).ok, false);
  assert.equal(validateExamInput({ ...validExam, maxAttempts: 21 }).ok, false);
});

test("normalizes and deduplicates roster addresses", () => {
  const result = validateRosterEmails(" Alice@Example.com\nalice@example.com; bob@example.com ");

  assert.deepEqual(result, {
    ok: true,
    value: ["alice@example.com", "bob@example.com"],
  });
});

test("rejects malformed roster addresses", () => {
  assert.deepEqual(validateRosterEmails("valid@example.com,not-an-email"), {
    ok: false,
    error: "Emails inválidos: not-an-email",
  });
});
