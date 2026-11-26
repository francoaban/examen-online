import assert from "node:assert/strict";
import test from "node:test";
import { logError } from "./logger";

test("logs structured errors without exposing environment secrets", () => {
  const secretName = "TEST_LOG_TOKEN";
  const previousSecret = process.env[secretName];
  const originalConsoleError = console.error;
  const secret = "test-token-that-must-not-leak";
  let output = "";

  process.env[secretName] = secret;
  console.error = (...args) => {
    output = String(args[0]);
  };

  try {
    logError("admin.saveExam", new Error(`Request failed with token=${secret}`));
  } finally {
    console.error = originalConsoleError;
    if (previousSecret === undefined) {
      delete process.env[secretName];
    } else {
      process.env[secretName] = previousSecret;
    }
  }

  const record = JSON.parse(output) as Record<string, unknown>;
  assert.equal(record.context, "admin.saveExam");
  assert.equal(record.level, "error");
  assert.equal(typeof record.ts, "string");
  assert.equal(output.includes(secret), false);
  assert.equal(typeof record.stack, "string");
});
