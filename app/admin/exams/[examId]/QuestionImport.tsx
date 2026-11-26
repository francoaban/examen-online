"use client";

import { useRef, useState } from "react";
import {
  MAX_IMPORT_QUESTIONS,
  parseCsv,
  rowsToQuestions,
  type ImportResult,
} from "@/lib/exam/question-import";
import type { QuestionInput } from "../../types";
import { Alert, Badge, Button } from "@/components/ui";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const TEMPLATE_URL = "/plantillas/preguntas-ejemplo.csv";

type Props = {
  existingCount: number;
  onImport: (questions: QuestionInput[], mode: "append" | "replace") => void;
};

/** Lee CSV en UTF-8; si trae caracteres inválidos, reintenta como Windows-1252 (CSV "ANSI" de Excel). */
async function readCsvText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

async function readFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls"))
    throw new Error(
      "El formato .xls (Excel 97-2003) no está soportado. En Excel usá «Guardar como» → Libro de Excel (.xlsx) o CSV.",
    );
  if (name.endsWith(".xlsx")) {
    // Se carga solo al importar un Excel: no suma peso al panel.
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rowsToQuestions(rows as Parameters<typeof rowsToQuestions>[0]);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv")
    return rowsToQuestions(parseCsv(await readCsvText(file)));
  throw new Error("Formato no soportado. Subí un archivo .csv o .xlsx.");
}

export function QuestionImport({ existingCount, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  function reset() {
    setFileName(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setError("El archivo supera los 2 MB.");
      return;
    }
    setReading(true);
    try {
      setResult(await readFile(file));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "No se pudo leer el archivo. Verificá que sea un CSV o Excel válido.",
      );
    } finally {
      setReading(false);
    }
  }

  function apply(mode: "append" | "replace") {
    if (!result || result.questions.length === 0) return;
    const total = (mode === "append" ? existingCount : 0) + result.questions.length;
    if (total > MAX_IMPORT_QUESTIONS) {
      setError(
        `El examen quedaría con ${total} preguntas; el máximo es ${MAX_IMPORT_QUESTIONS}.`,
      );
      return;
    }
    if (
      mode === "replace" &&
      existingCount > 0 &&
      !window.confirm(
        `¿Reemplazar las ${existingCount} preguntas actuales por las ${result.questions.length} importadas?\n\nNo se guarda nada hasta que toques «Guardar preguntas».`,
      )
    )
      return;
    onImport(result.questions, mode);
    reset();
  }

  const valid = result?.questions ?? [];
  const errors = result?.errors ?? [];
  const totalPoints = valid.reduce((acc, q) => acc + q.points, 0);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Importar desde CSV o Excel</p>
          <p className="text-xs text-slate-500">
            Columnas: tipo, enunciado, puntos, opcion_1…opcion_N, correcta (número desde 1,
            letra o texto) y rubrica.{" "}
            <a
              href={TEMPLATE_URL}
              download
              className="font-medium text-indigo-700 underline-offset-2 hover:underline"
            >
              Descargar plantilla de ejemplo
            </a>
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <span className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-100">
            {reading ? "Leyendo…" : "Elegir archivo…"}
          </span>
        </label>
      </div>

      {error ? (
        <Alert tone="red">
          {fileName ? <strong>{fileName}: </strong> : null}
          {error}
        </Alert>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-800">{fileName}</span>
            <Badge tone={valid.length > 0 ? "emerald" : "slate"}>
              {valid.length} {valid.length === 1 ? "pregunta válida" : "preguntas válidas"}
            </Badge>
            {errors.length > 0 ? (
              <Badge tone="red">
                {errors.length} {errors.length === 1 ? "fila con error" : "filas con error"}
              </Badge>
            ) : null}
            {valid.length > 0 ? (
              <span className="text-xs text-slate-500">{totalPoints} puntos</span>
            ) : null}
          </div>

          {errors.length > 0 ? (
            <Alert tone="amber" title="Filas que no se van a importar">
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {errors.slice(0, 8).map((issue, index) => (
                  <li key={`${issue.row}-${index}`}>
                    {issue.row > 0 ? `Fila ${issue.row}: ` : ""}
                    {issue.message}
                  </li>
                ))}
                {errors.length > 8 ? <li>… y {errors.length - 8} más.</li> : null}
              </ul>
            </Alert>
          ) : null}

          {valid.length > 0 ? (
            <ol className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs">
              {valid.map((question, index) => (
                <li key={index} className="flex items-start gap-2 px-1 py-0.5">
                  <span className="w-6 shrink-0 text-right text-slate-400">{index + 1}.</span>
                  <Badge tone={question.type === "mc" ? "indigo" : "sky"}>
                    {question.type === "mc" ? "MO" : "Desarrollo"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-slate-800" title={question.prompt}>
                    {question.prompt}
                  </span>
                  <span className="shrink-0 text-slate-500">
                    {question.type === "mc" && question.correctOption != null
                      ? `✔ ${question.options[question.correctOption]}`
                      : ""}
                  </span>
                  <span className="w-12 shrink-0 text-right text-slate-500">
                    {question.points} pts
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => apply("append")}
              disabled={valid.length === 0}
            >
              Agregar al final
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => apply("replace")}
              disabled={valid.length === 0}
            >
              Reemplazar las actuales
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
