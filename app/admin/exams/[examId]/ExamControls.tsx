"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteExam,
  duplicateExam,
  publishResults,
  recalcAllAttempts,
  setExamStatus,
} from "../../actions";
import type { ActionResult } from "../../types";
import { Alert, Button } from "@/components/ui";

type Props = {
  examId: string;
  status: string;
  resultsPublished: boolean;
};

export function ExamControls({ examId, status, resultsPublished }: Props) {
  const router = useRouter();
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
    <div className="space-y-3">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="emerald">{message}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/examen/${examId}?preview=1`}>
          <Button variant="secondary">Vista previa</Button>
        </Link>
        <a href={`/api/admin/exams/${examId}/export`}>
          <Button variant="secondary">Exportar CSV</Button>
        </a>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setMessage(null);
            try {
              const result = await duplicateExam(examId);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(`/admin/exams/${result.data.examId}`);
            } catch {
              setError("No se pudo duplicar el examen.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Duplicar examen
        </Button>

        {status !== "open" ? (
          <Button
            variant="success"
            disabled={busy}
            onClick={() =>
              run(() => setExamStatus(examId, "open"), "El examen quedó abierto.")
            }
          >
            Abrir examen
          </Button>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(() => setExamStatus(examId, "closed"), "El examen quedó cerrado.")
            }
          >
            Cerrar examen
          </Button>
        )}

        <Button
          variant={resultsPublished ? "secondary" : "primary"}
          disabled={busy}
          onClick={() =>
            run(
              () => publishResults(examId, !resultsPublished),
              resultsPublished
                ? "Las notas dejaron de ser visibles para los alumnos."
                : "Las notas ya son visibles para los alumnos.",
            )
          }
        >
          {resultsPublished ? "Ocultar notas" : "Publicar notas"}
        </Button>

        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(() => recalcAllAttempts(examId), "Notas recalculadas.")
          }
        >
          Recalcular notas
        </Button>

        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-50"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                "¿Eliminar el examen con todas sus preguntas, intentos y respuestas? No se puede deshacer.",
              )
            )
              return;
            void run(async () => {
              const result = await deleteExam(examId);
              if (result.ok) router.push("/admin");
              return result;
            }, "Examen eliminado.");
          }}
        >
          Eliminar examen
        </Button>
      </div>
    </div>
  );
}
