import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_STUDENTS_PER_BATCH,
  displayNameFor,
  generateTemporaryPassword,
  parseStudentList,
  validatePasswordLength,
} from "./students";

test("parseStudentList accepts emails with optional names and separators", () => {
  const result = parseStudentList(
    [
      "email,nombre",
      "Ana@Example.com, Ana Pérez",
      "beto@example.com;Beto Gómez",
      "carla@example.com\tCarla",
      "dani@example.com",
      "",
      "ana@example.com, duplicada",
    ].join("\r\n"),
  );
  assert.ok(result.ok);
  assert.deepEqual(result.value, [
    { email: "ana@example.com", name: "Ana Pérez" },
    { email: "beto@example.com", name: "Beto Gómez" },
    { email: "carla@example.com", name: "Carla" },
    { email: "dani@example.com", name: "" },
  ]);
});

test("parseStudentList rejects invalid emails, empty lists and oversized batches", () => {
  const invalid = parseStudentList("ok@example.com\nsin-arroba, Nombre");
  assert.equal(invalid.ok, false);
  assert.match(invalid.ok ? "" : invalid.error, /sin-arroba/);

  assert.equal(parseStudentList("  \n ").ok, false);

  const many = Array.from(
    { length: MAX_STUDENTS_PER_BATCH + 1 },
    (_, i) => `a${i}@example.com`,
  ).join("\n");
  assert.equal(parseStudentList(many).ok, false);
});

test("generateTemporaryPassword is long enough, readable and random", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const password = generateTemporaryPassword();
    assert.match(password, /^[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}-[a-km-zA-HJ-NP-Z2-9]{4}$/);
    assert.equal(validatePasswordLength(password), null);
    seen.add(password);
  }
  assert.equal(seen.size, 200);
});

test("validatePasswordLength and displayNameFor", () => {
  assert.ok(validatePasswordLength("corta"));
  assert.equal(validatePasswordLength("x".repeat(12)), null);
  assert.ok(validatePasswordLength("x".repeat(129)));
  assert.equal(displayNameFor({ email: "juan.p@example.com", name: "" }), "juan.p");
  assert.equal(displayNameFor({ email: "juan.p@example.com", name: "Juan" }), "Juan");
});
