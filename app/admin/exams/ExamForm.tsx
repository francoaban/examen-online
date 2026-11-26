"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExam, saveExamSettings } from "../actions";
import type { ExamInput } from "../types";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";

type Props = {
  initial: ExamInput;
  mode: "create" | "edit";
  examId?: string;
};

export function ExamForm({ initial, mode, examId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ExamInput>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Recuerda la última duración para restaurarla al destildar "Sin límite".
  const [lastDuration, setLastDuration] = useState(initial.durationMinutes ?? 60);
  const unlimited = form.durationMinutes == null;

  function update<K extends keyof ExamInput>(key: K, value: ExamInput[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      if (mode === "create") {
        const result = await createExam(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/admin/exams/${result.data.examId}`);
        return;
      }

      if (!examId) {
        setError("Falta el examen.");
        return;
      }

      const result = await saveExamSettings(examId, form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {error ? <Alert tone="red">{error}</Alert> : null}
      {saved ? <Alert tone="emerald">Cambios guardados.</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" htmlFor="title" className="sm:col-span-2">
          <Input
            id="title"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Examen de Arquitectura de Computadoras"
            required
          />
        </Field>

        <Field
          label="Identificador (URL)"
          htmlFor="slug"
          hint="Opcional. Si lo dejás vacío se genera del título."
        >
          <Input
            id="slug"
            value={form.slug}
            onChange={(event) => update("slug", event.target.value)}
            placeholder="arquitectura-u1"
          />
        </Field>

        <Field
          label="Duración (minutos)"
          htmlFor="duration"
          hint={
            unlimited
              ? "Sin límite: cada intento puede durar hasta el cierre del examen."
              : "Tiempo de cada intento, desde que el alumno lo comienza."
          }
        >
          <div className="space-y-2">
            <Input
              id="duration"
              type="number"
              min={1}
              max={600}
              value={unlimited ? "" : (form.durationMinutes ?? "")}
              placeholder={unlimited ? "Sin límite" : undefined}
              disabled={unlimited}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                setLastDuration(minutes);
                update("durationMinutes", minutes);
              }}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="size-4 accent-indigo-600"
                checked={unlimited}
                onChange={(event) =>
                  update(
                    "durationMinutes",
                    event.target.checked ? null : lastDuration || 60,
                  )
                }
              />
              Sin límite de tiempo
            </label>
          </div>
        </Field>

        <Field
          label="Intentos permitidos por alumno"
          htmlFor="maxAttempts"
          hint="Entre 1 y 20. Las vistas previas docentes no cuentan."
        >
          <Input
            id="maxAttempts"
            type="number"
            min={1}
            max={20}
            value={form.maxAttempts}
            onChange={(event) => update("maxAttempts", Number(event.target.value))}
          />
        </Field>

        <Field label="Descripción" htmlFor="description" className="sm:col-span-2">
          <Textarea
            id="description"
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Consignas generales, material permitido, etc."
          />
        </Field>

        <Field label="Apertura" htmlFor="opensAt" hint="Hora de Argentina (UTC-3).">
          <Input
            id="opensAt"
            type="datetime-local"
            value={form.opensAt}
            onChange={(event) => update("opensAt", event.target.value)}
            required
          />
        </Field>

        <Field label="Cierre" htmlFor="closesAt" hint="Después de esta hora nadie puede empezar.">
          <Input
            id="closesAt"
            type="datetime-local"
            value={form.closesAt}
            onChange={(event) => update("closesAt", event.target.value)}
            required
          />
        </Field>

        <Field
          label="Segundos fuera de foco para contar advertencia"
          htmlFor="warnAfterSeconds"
          hint="Las salidas más cortas se registran igual, pero no suman advertencia."
        >
          <Input
            id="warnAfterSeconds"
            type="number"
            min={0}
            max={600}
            value={form.warnAfterSeconds}
            onChange={(event) =>
              update("warnAfterSeconds", Number(event.target.value))
            }
          />
        </Field>

        <Field
          label="Máximo de advertencias"
          htmlFor="maxWarnings"
          hint="Al llegar a este número el aviso del alumno pasa a rojo."
        >
          <Input
            id="maxWarnings"
            type="number"
            min={0}
            max={50}
            value={form.maxWarnings}
            onChange={(event) => update("maxWarnings", Number(event.target.value))}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 accent-indigo-600"
            checked={form.shuffleQuestions}
            onChange={(event) => update("shuffleQuestions", event.target.checked)}
          />
          Mezclar el orden de las preguntas para cada alumno
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 accent-indigo-600"
            checked={form.shuffleOptions}
            onChange={(event) => update("shuffleOptions", event.target.checked)}
          />
          Mezclar el orden de las opciones en cada pregunta
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-indigo-600"
            checked={form.showScoreOnSubmit}
            onChange={(event) => update("showScoreOnSubmit", event.target.checked)}
          />
          <span>
            Mostrar la nota al finalizar el examen
            <span className="block text-xs text-slate-500">
              El alumno ve su puntaje apenas entrega. Si hay preguntas a desarrollar, se
              muestra como nota parcial hasta que las corrijas. Las respuestas correctas
              se ven recién cuando publicás las notas.
            </span>
          </span>
        </label>
      </div>

      <Button type="submit" disabled={busy}>
        {busy
          ? "Guardando…"
          : mode === "create"
            ? "Crear examen"
            : "Guardar cambios"}
      </Button>
    </form>
  );
}
