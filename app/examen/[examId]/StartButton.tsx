"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";

export function StartButton({
  examId,
  isPreview = false,
  timeLimited = true,
  attemptNumber = 1,
}: {
  examId: string;
  isPreview?: boolean;
  timeLimited?: boolean;
  attemptNumber?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;

    const timing = timeLimited
      ? "El cronómetro empieza a correr ahora y no se puede pausar. Si cerrás la pestaña, el tiempo sigue avanzando."
      : "No hay límite de tiempo, pero el examen se cierra en la fecha de cierre.";
    const confirmed = window.confirm(
      isPreview
        ? "¿Iniciar la vista previa?\n\nEste intento no afecta las estadísticas de alumnos."
        : `${attemptNumber > 1 ? `¿Comenzar el intento ${attemptNumber}?` : "¿Comenzar el examen?"}\n\n${timing}\n\nEl intento cuenta desde que lo comenzás.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/attempts/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examId, preview: isPreview }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        attemptId?: string;
        error?: string;
      };

      if (!isPreview && res.status === 409 && data.attemptId) {
        router.replace(`/examen/attempt/${data.attemptId}`);
        return;
      }
      if (!res.ok || !data.attemptId) {
        setError(data.error ?? "No se pudo comenzar el examen.");
        return;
      }

      router.replace(`/examen/attempt/${data.attemptId}`);
    } catch {
      setError("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Button size="lg" onClick={start} disabled={busy} className="w-full sm:w-auto">
        {busy
          ? "Iniciando…"
          : isPreview
            ? "Iniciar vista previa"
            : attemptNumber > 1
              ? `Comenzar intento ${attemptNumber}`
              : "Comenzar examen"}
      </Button>
    </div>
  );
}
