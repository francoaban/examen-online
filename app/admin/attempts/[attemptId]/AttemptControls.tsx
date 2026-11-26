"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extendTime, resetAttempt } from "../../actions";
import type { ActionResult } from "../../types";
import { Alert, Button, Input } from "@/components/ui";

export function AttemptControls({
  attemptId,
  isOpen,
}: {
  attemptId: string;
  isOpen: boolean;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: () => Promise<ActionResult>,
    successMessage: string,
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(successMessage);
      router.refresh();
    } catch {
      setError("La operación falló.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="emerald">{message}</Alert> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-600">
          Extender tiempo (min)
          <Input
            type="number"
            min={1}
            max={120}
            className="mt-1 h-9 w-24 text-sm"
            value={minutes}
            disabled={!isOpen || busy}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={!isOpen || busy}
          onClick={() =>
            run(
              () => extendTime(attemptId, Number(minutes)),
              `Se extendió el plazo ${minutes} minutos.`,
            )
          }
        >
          Extender
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                "¿Borrar el intento y permitir que el alumno rinda de nuevo? Se pierden sus respuestas y el historial de eventos.",
              )
            )
              return;
            void run(
              () => resetAttempt(attemptId),
              "Intento eliminado. El alumno puede volver a empezar.",
            );
          }}
        >
          Reiniciar intento
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Las dos acciones quedan registradas como intervención del docente (usar solo
        ante problemas técnicos comprobados).
      </p>
    </div>
  );
}
