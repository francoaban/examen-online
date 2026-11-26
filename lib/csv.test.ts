import assert from "node:assert/strict";
import test from "node:test";
import { serializeCsv } from "./csv";

test("serializes CSV cells with quotes and line breaks safely", () => {
  assert.equal(
    serializeCsv([["Nombre", "Comentario"], ['Ana "A"', "primera\nsegunda"]]),
    '"Nombre","Comentario"\r\n"Ana ""A""","primera\nsegunda"\r\n',
  );
});

test("neutralizes spreadsheet formulas after leading whitespace", () => {
  assert.equal(
    serializeCsv([["=1+1", "  @SUM(A1:A2)", "+cmd", "-2"]]),
    "\"'=1+1\",\"'  @SUM(A1:A2)\",\"'+cmd\",\"'-2\"\r\n",
  );
});
