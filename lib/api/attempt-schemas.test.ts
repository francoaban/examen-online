import assert from "node:assert/strict";
import test from "node:test";
import {
  recordEventsSchema,
  saveAnswerSchema,
  startAttemptSchema,
} from "./attempt-schemas";

test("validates the exam id used to start an attempt", () => {
  assert.equal(
    startAttemptSchema.safeParse({
      examId: "123e4567-e89b-12d3-a456-426614174000",
      preview: true,
    }).success,
    true,
  );
  assert.equal(
    startAttemptSchema.safeParse({
      examId: "123e4567-e89b-12d3-a456-426614174000",
      preview: "yes",
    }).success,
    false,
  );
  assert.equal(startAttemptSchema.safeParse({ examId: "not-an-id" }).success, false);
  assert.equal(startAttemptSchema.safeParse({}).success, true);
});

test("validates answer payload types while allowing optional answer fields", () => {
  const questionId = "123e4567-e89b-12d3-a456-426614174000";

  assert.equal(saveAnswerSchema.safeParse({ questionId }).success, true);
  assert.equal(
    saveAnswerSchema.safeParse({ questionId, selectedOption: 1 }).success,
    true,
  );
  assert.equal(
    saveAnswerSchema.safeParse({ questionId, selectedOption: 1.5 }).success,
    false,
  );
  assert.equal(
    saveAnswerSchema.safeParse({ questionId, answerText: 4 }).success,
    false,
  );
});

test("validates event payloads and object metadata", () => {
  assert.equal(
    recordEventsSchema.safeParse({
      events: [{ type: "heartbeat", meta: { remainingMs: 1200 } }],
    }).success,
    true,
  );
  assert.equal(
    recordEventsSchema.safeParse({ events: [{ type: "focus", meta: "invalid" }] })
      .success,
    false,
  );
  assert.equal(recordEventsSchema.safeParse({ type: "focus" }).success, true);
});
