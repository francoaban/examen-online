"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveQuestions } from "../../actions";
import type { QuestionInput } from "../../types";
import { Alert, Badge, Button, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { QuestionImport } from "./QuestionImport";

type Props = {
  examId: string;
  initial: QuestionInput[];
};

function emptyQuestion(type: "mc" | "text"): QuestionInput {
  return {
    type,
    prompt: "",
    points: 1,
    options: type === "mc" ? ["", "", "", ""] : [],
    correctOption: type === "mc" ? 0 : null,
    rubric: null,
  };
}

export function QuestionsEditor({ examId, initial }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<QuestionInput[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  function importQuestions(rows: QuestionInput[], mode: "append" | "replace") {
    setItems((previous) => (mode === "append" ? [...previous, ...rows] : rows));
    setImported(rows.length);
    setSaved(false);
    setError(null);
  }

  function patch(index: number, changes: Partial<QuestionInput>) {
    setItems((previous) =>
      previous.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    );
    setSaved(false);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((previous) => {
      if (target >= previous.length || index >= previous.length) return previous;
      const copy = [...previous];
      const current = copy[index];
      const destination = copy[target];
      if (!current || !destination) return previous;
      copy[index] = destination;
      copy[target] = current;
      return copy;
    });
    setSaved(false);
  }

  function remove(index: number) {
    setItems((previous) => previous.filter((_, i) => i !== index));
    setSaved(false);
  }

  function setOption(index: number, optionIndex: number, value: string) {
    const current = items[index];
    if (!current) return;
    const options = [...current.options];
    options[optionIndex] = value;
    patch(index, { options });
  }

  function addOption(index: number) {
    const current = items[index];
    if (!current) return;
    patch(index, { options: [...current.options, ""] });
  }

  function removeOption(index: number, optionIndex: number) {
    const current = items[index];
    if (!current) return;
    const options = current.options.filter((_, i) => i !== optionIndex);
    let correctOption = current.correctOption;
    if (correctOption === optionIndex) correctOption = 0;
    else if (correctOption != null && correctOption > optionIndex)
      correctOption -= 1;
    patch(index, { options, correctOption });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveQuestions(examId, items);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setImported(null);
      router.refresh();
    } catch {
      setError("No se pudieron guardar las preguntas.");
    } finally {
      setBusy(false);
    }
  }

  const totalPoints = items.reduce((acc, item) => acc + (Number(item.points) || 0), 0);

  return (
    <div className="space-y-4">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {saved ? <Alert tone="emerald">Preguntas guardadas.</Alert> : null}

      <QuestionImport existingCount={items.length} onImport={importQuestions} />

      {imported != null ? (
        <Alert tone="indigo" title={`Se importaron ${imported} preguntas`}>
          Revisalas abajo y tocá <strong>Guardar preguntas</strong> para que queden en
          el examen. Hasta entonces no se guarda nada.
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <Alert tone="amber">
          No hay preguntas cargadas. El examen no se puede abrir hasta tener al menos
          una.
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={`${item.id ?? "new"}-${index}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="indigo">Pregunta {index + 1}</Badge>
                <select
                  className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                  value={item.type}
                  onChange={(event) => {
                    const type = event.target.value as "mc" | "text";
                    patch(index, {
                      type,
                      options:
                        type === "mc" && item.options.length === 0
                          ? ["", "", "", ""]
                          : item.options,
                      correctOption:
                        type === "mc" ? (item.correctOption ?? 0) : null,
                    });
                  }}
                >
                  <option value="mc">Múltiple opción</option>
                  <option value="text">A desarrollar</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  Puntos
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    step="0.5"
                    className="h-8 w-20 text-xs"
                    value={item.points}
                    onChange={(event) =>
                      patch(index, { points: Number(event.target.value) })
                    }
                  />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Subir"
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Bajar"
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => remove(index)}
                >
                  Eliminar
                </Button>
              </div>
            </div>

            <Textarea
              value={item.prompt}
              onChange={(event) => patch(index, { prompt: event.target.value })}
              placeholder="Enunciado de la pregunta"
              className="min-h-20"
            />

            {item.type === "mc" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  Opciones · marcá la correcta
                </p>
                {item.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      className="size-4 shrink-0 accent-emerald-600"
                      name={`correct-${index}`}
                      checked={item.correctOption === optionIndex}
                      onChange={() => patch(index, { correctOption: optionIndex })}
                      aria-label={`Opción ${optionIndex + 1} correcta`}
                    />
                    <Input
                      value={option}
                      onChange={(event) =>
                        setOption(index, optionIndex, event.target.value)
                      }
                      placeholder={`Opción ${optionIndex + 1}`}
                      className={cn(
                        "h-9 text-sm",
                        item.correctOption === optionIndex && "border-emerald-400",
                      )}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOption(index, optionIndex)}
                      disabled={item.options.length <= 2}
                      aria-label="Quitar opción"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => addOption(index)}>
                  Agregar opción
                </Button>
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  Rúbrica / respuesta esperada (solo la ve el docente)
                </p>
                <Textarea
                  value={item.rubric ?? ""}
                  onChange={(event) => patch(index, { rubric: event.target.value })}
                  placeholder="Qué se espera para considerar la respuesta correcta."
                  className="min-h-16"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setItems((previous) => [...previous, emptyQuestion("mc")])}
        >
          + Múltiple opción
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setItems((previous) => [...previous, emptyQuestion("text")])}
        >
          + A desarrollar
        </Button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {items.length} preguntas · {totalPoints} puntos
          </span>
          <Button onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar preguntas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
