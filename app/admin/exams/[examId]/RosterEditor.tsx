"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveRoster } from "../../actions";
import { Alert, Button, Textarea } from "@/components/ui";

export function RosterEditor({
  examId,
  initial,
}: {
  examId: string;
  initial: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initial.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean).length;

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await saveRoster(examId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.data.count === 0
          ? "Lista vacía: nadie va a poder rendir este examen."
          : `Lista guardada con ${result.data.count} emails.`,
      );
      router.refresh();
    } catch {
      setError("No se pudo guardar la lista.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {message ? <Alert tone="emerald">{message}</Alert> : null}

      <Alert tone="sky" title="Es la única barrera de acceso">
        Solo los emails de esta lista pueden abrir el examen. Podés pegar una columna
        de Excel: se aceptan saltos de línea, comas y punto y coma.
      </Alert>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"alumno1@gmail.com\nalumno2@gmail.com"}
        className="min-h-48 font-mono text-sm"
        spellCheck={false}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{count} emails detectados</span>
        <Button onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar lista"}
        </Button>
      </div>
    </div>
  );
}
