import type { QuestionInput } from "./types";

/**
 * Importación de preguntas desde CSV o Excel.
 *
 * Formato (ver public/plantillas/preguntas-ejemplo.csv). La primera fila son los
 * encabezados; el orden de las columnas no importa y se aceptan variantes
 * (mayúsculas, tildes, espacios, inglés):
 *
 *   tipo        mc | text (también "múltiple opción", "desarrollo", …).
 *               Si está vacío: mc cuando hay opciones, text si no.
 *   enunciado   texto de la pregunta (obligatorio).
 *   puntos      número ≥ 0; acepta coma decimal ("1,5"). Vacío = 1.
 *   opcion_1…N  opciones de múltiple opción (vacías se ignoran).
 *   correcta    número de la opción correcta contando desde 1, una letra
 *               (A, B, C…) o el texto exacto de la opción.
 *   rubrica     guía de corrección (solo para "text").
 *
 * Función pura: no toca la base. El servidor vuelve a validar al guardar.
 */

export const MAX_IMPORT_QUESTIONS = 200;

export type ImportIssue = { row: number; message: string };

export type ImportResult = {
  questions: QuestionInput[];
  errors: ImportIssue[];
  /** Filas de datos leídas (sin contar encabezado ni filas vacías). */
  rowCount: number;
};

type Cell = string | number | boolean | Date | null | undefined;

/* ------------------------------------------------------------------ CSV --- */

/** Detecta el separador mirando la primera línea (fuera de comillas). */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && char in counts) counts[char] = (counts[char] ?? 0) + 1;
  }
  // Excel en español guarda CSV con ";". Ante empate o ninguno, coma.
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [",", 0];
  return count > 0 ? best : ",";
}

/** Parser CSV (RFC 4180): comillas, comillas dobles escapadas, saltos de línea dentro de celdas. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------ columnas --- */

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const COLUMN_ALIASES: Record<string, string[]> = {
  type: ["tipo", "type", "tipo_de_pregunta"],
  prompt: ["enunciado", "pregunta", "prompt", "consigna", "question"],
  points: ["puntos", "puntaje", "points", "score", "valor"],
  correct: ["correcta", "respuesta_correcta", "respuesta", "correct", "answer"],
  rubric: ["rubrica", "rubric", "respuesta_esperada", "criterio", "guia"],
};

type ColumnMap = {
  type?: number;
  prompt?: number;
  points?: number;
  correct?: number;
  rubric?: number;
  options: number[];
};

function mapColumns(header: Cell[]): ColumnMap {
  const map: ColumnMap = { options: [] };
  const optionColumns: Array<{ index: number; order: number }> = [];

  header.forEach((raw, index) => {
    const key = normalizeKey(cellText(raw));
    if (!key) return;
    const option = key.match(/^(?:opcion|option|alternativa|opt)_?(\d+)$/);
    if (option) {
      optionColumns.push({ index, order: Number(option[1]) });
      return;
    }
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(key) && map[field as keyof Omit<ColumnMap, "options">] == null) {
        map[field as keyof Omit<ColumnMap, "options">] = index;
      }
    }
  });

  map.options = optionColumns.sort((a, b) => a.order - b.order).map((o) => o.index);
  return map;
}

/* --------------------------------------------------------------- celdas --- */

function cellText(value: Cell): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  // Nuestro export antepone ' a celdas que empiezan con = + - @ (anti fórmula).
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function parseType(raw: string, hasOptions: boolean): "mc" | "text" | null {
  const key = normalizeKey(raw);
  if (!key) return hasOptions ? "mc" : "text";
  if (["mc", "mo", "multiple", "multiple_opcion", "opcion_multiple", "multiple_choice", "choice", "om"].includes(key))
    return "mc";
  if (["text", "texto", "desarrollo", "a_desarrollar", "abierta", "open", "essay", "libre"].includes(key))
    return "text";
  return null;
}

function parsePoints(raw: Cell): number | null {
  if (typeof raw === "number") return raw;
  const text = cellText(raw).replace(",", ".");
  if (!text) return 1;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Devuelve el índice 0-based de la opción correcta, o null si no se reconoce. */
function parseCorrect(raw: Cell, options: string[]): number | null {
  const text = cellText(raw);
  if (!text) return null;
  const inRange = (index: number) => index >= 0 && index < options.length;

  // 1) Posición (1, 2, 3…) si es válida.
  if (/^\d+$/.test(text) && inRange(Number(text) - 1)) return Number(text) - 1;
  // 2) Letra (A, B, C…) si es válida.
  if (/^[a-z]$/i.test(text) && inRange(text.toLowerCase().charCodeAt(0) - 97))
    return text.toLowerCase().charCodeAt(0) - 97;
  // 3) Texto exacto de una opción (útil cuando las opciones son números).
  const same = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const byText = options.findIndex((option) => same(option) === same(text));
  return byText >= 0 ? byText : null;
}

/* ------------------------------------------------------------ principal --- */

/** Convierte filas (CSV o Excel) en preguntas, con errores por fila. */
export function rowsToQuestions(rows: Cell[][]): ImportResult {
  const errors: ImportIssue[] = [];
  const questions: QuestionInput[] = [];

  const headerIndex = rows.findIndex((row) => row.some((cell) => cellText(cell)));
  if (headerIndex < 0)
    return { questions, errors: [{ row: 1, message: "El archivo está vacío." }], rowCount: 0 };

  const header = rows[headerIndex] ?? [];
  const columns = mapColumns(header);
  if (columns.prompt == null) {
    return {
      questions,
      errors: [
        {
          row: headerIndex + 1,
          message:
            "No se encontró la columna «enunciado». La primera fila debe tener los encabezados (tipo, enunciado, puntos, opcion_1…, correcta, rubrica).",
        },
      ],
      rowCount: 0,
    };
  }

  let rowCount = 0;
  for (let r = headerIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    if (!row.some((cell) => cellText(cell))) continue; // fila vacía
    rowCount += 1;
    const line = r + 1; // número de fila como lo ve el docente en Excel
    const at = (index: number | undefined): Cell => (index == null ? null : row[index]);

    const prompt = cellText(at(columns.prompt));
    if (!prompt) {
      errors.push({ row: line, message: "Falta el enunciado." });
      continue;
    }

    const options = columns.options.map((index) => cellText(row[index])).filter(Boolean);
    const type = parseType(cellText(at(columns.type)), options.length > 0);
    if (!type) {
      errors.push({
        row: line,
        message: `Tipo «${cellText(at(columns.type))}» no reconocido. Usá «mc» o «text».`,
      });
      continue;
    }

    const points = parsePoints(at(columns.points));
    if (points == null || points < 0 || points > 1000) {
      errors.push({ row: line, message: "Puntaje inválido (debe ser un número entre 0 y 1000)." });
      continue;
    }

    if (type === "mc") {
      if (options.length < 2) {
        errors.push({ row: line, message: "Una pregunta de múltiple opción necesita al menos 2 opciones." });
        continue;
      }
      const correctOption = parseCorrect(at(columns.correct), options);
      if (correctOption == null || correctOption < 0 || correctOption >= options.length) {
        errors.push({
          row: line,
          message: `Respuesta correcta inválida: indicá un número del 1 al ${options.length}, una letra o el texto de la opción.`,
        });
        continue;
      }
      questions.push({ type, prompt, points, options, correctOption, rubric: null });
    } else {
      questions.push({
        type,
        prompt,
        points,
        options: [],
        correctOption: null,
        rubric: cellText(at(columns.rubric)) || null,
      });
    }
  }

  if (rowCount === 0) errors.push({ row: headerIndex + 2, message: "No hay preguntas debajo de los encabezados." });
  if (questions.length > MAX_IMPORT_QUESTIONS)
    errors.push({ row: 0, message: `Máximo ${MAX_IMPORT_QUESTIONS} preguntas por examen.` });

  return { questions, errors, rowCount };
}
