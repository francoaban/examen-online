"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gradeAnswer } from "../../actions";
import { Alert, Button, Input, Textarea } from "@/components/ui";

type Props = {
  attemptId: string;
  answerId: string;
  maxPoints: number;
  initialPoints: number | null;
  initialFeedback: string | null;
  disabled?: boolean;
};

export function GradeForm({
  attemptId,
  answerId,
  maxPoints,
  initialPoints,
  initialFeedback,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [points, setPoints] = useState(
    initialPoints == null ? "" : String(initialPoints),
  );
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);

    const value = points.trim() === "" ? null : Number(points);
    if (value != null && (Number.isNaN(value) || value < 0 || value > maxPoints)) {
      setError(`El puntaje debe estar entre 0 y ${maxPoints}.`);
      setBusy(false);
      return;
    }

    try {
      const result = await gradeAnswer(attemptId, answerId, value, feedback);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar la corrección.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {saved ? <Alert tone="emerald">Corrección guardada.</Alert> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          Puntaje (máx. {maxPoints})
          <Input
            type="number"
            min={0}
            max={maxPoints}
            step="0.5"
            className="mt-1 h-9 w-24 text-sm"
            value={points}
            disabled={disabled || busy}
            onChange={(event) => {
              setPoints(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <Button size="sm" onClick={save} disabled={disabled || busy}>
          {busy ? "Guardando…" : "Guardar puntaje"}
        </Button>
        {points.trim() !== "" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => {
              setPoints("");
              setSaved(false);
            }}
          >
            Limpiar
          </Button>
        ) : null}
      </div>

      <Textarea
        value={feedback}
        placeholder="Devolución para el alumno (opcional)"
        className="min-h-16 text-sm"
        disabled={disabled || busy}
        onChange={(event) => {
          setFeedback(event.target.value);
          setSaved(false);
        }}
      />
    </div>
  );
}
