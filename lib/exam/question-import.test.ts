import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCsv, rowsToQuestions } from "./question-import";

test("imports the bundled example CSV without errors", () => {
  const text = readFileSync("public/plantillas/preguntas-ejemplo.csv", "utf8");
  const result = rowsToQuestions(parseCsv(text));

  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 13);
  const [first] = result.questions;
  assert.equal(first?.type, "mc");
  assert.equal(first?.options.length, 4);
  assert.equal(first?.correctOption, 1); // "2" en el CSV = segunda opción
  const text3 = result.questions.filter((q) => q.type === "text");
  assert.equal(text3.length, 3);
  assert.ok(text3.every((q) => q.rubric && q.options.length === 0));
});

test("parses semicolon CSV, quoted newlines, and escaped quotes", () => {
  const csv =
    '﻿Tipo;Enunciado;Puntos;Opción 1;Opción 2;Correcta\r\n' +
    'mc;"Línea 1\nLínea 2 con ""comillas""";1,5;Sí;No;B\r\n';
  const result = rowsToQuestions(parseCsv(csv));

  assert.deepEqual(result.errors, []);
  assert.equal(result.questions[0]?.prompt, 'Línea 1\nLínea 2 con "comillas"');
  assert.equal(result.questions[0]?.points, 1.5);
  assert.equal(result.questions[0]?.correctOption, 1);
});

test("accepts Excel-style cells, option text as answer, and inferred types", () => {
  const rows = [
    ["pregunta", "puntaje", "opcion_1", "opcion_2", "opcion_3", "respuesta", "rúbrica"],
    ["¿2+2?", 2, "3", "4", "5", "4", null],
    ["Explicá algo", null, null, null, null, null, "Debe mencionar X"],
    [null, null, null, null, null, null, null],
  ];
  const result = rowsToQuestions(rows);

  assert.deepEqual(result.errors, []);
  assert.equal(result.rowCount, 2);
  assert.equal(result.questions[0]?.type, "mc");
  assert.equal(result.questions[0]?.correctOption, 1);
  assert.equal(result.questions[1]?.type, "text");
  assert.equal(result.questions[1]?.points, 1);
});

test("reports row-level errors with spreadsheet row numbers", () => {
  const rows = [
    ["tipo", "enunciado", "opcion_1", "opcion_2", "correcta"],
    ["mc", "", "a", "b", "1"],
    ["mc", "Sin opciones suficientes", "a", "", "1"],
    ["mc", "Correcta fuera de rango", "a", "b", "3"],
    ["verdadero", "Tipo raro", "", "", ""],
    ["mc", "Válida", "a", "b", "1"],
  ];
  const result = rowsToQuestions(rows);

  assert.equal(result.questions.length, 1);
  assert.deepEqual(
    result.errors.map((e) => e.row),
    [2, 3, 4, 5],
  );
});

test("requires a prompt column", () => {
  const result = rowsToQuestions([["a", "b"], ["1", "2"]]);
  assert.equal(result.questions.length, 0);
  assert.match(result.errors[0]?.message ?? "", /enunciado/);
});
