"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  EmptyState,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { formatCountdown, formatDateTime, formatDuration } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 10_000;

type LiveAttempt = {
  id: string;
  name: string | null;
  email: string;
  startedAt: string;
  deadlineAt: string;
  attemptNumber: number;
  focusLossCount: number;
  focusLostMs: number;
  awayNow: boolean;
};

type LiveStatus = {
  serverNow: string;
  attempts: LiveAttempt[];
};

function isLiveAttempt(value: unknown): value is LiveAttempt {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    (typeof value.name === "string" || value.name === null) &&
    "email" in value &&
    typeof value.email === "string" &&
    "startedAt" in value &&
    typeof value.startedAt === "string" &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    "deadlineAt" in value &&
    typeof value.deadlineAt === "string" &&
    Number.isFinite(Date.parse(value.deadlineAt)) &&
    "attemptNumber" in value &&
    typeof value.attemptNumber === "number" &&
    "focusLossCount" in value &&
    typeof value.focusLossCount === "number" &&
    "focusLostMs" in value &&
    typeof value.focusLostMs === "number" &&
    "awayNow" in value &&
    typeof value.awayNow === "boolean"
  );
}

function isLiveStatus(value: unknown): value is LiveStatus {
  if (typeof value !== "object" || value === null) return false;
  return (
    "serverNow" in value &&
    typeof value.serverNow === "string" &&
    Number.isFinite(Date.parse(value.serverNow)) &&
    "attempts" in value &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isLiveAttempt)
  );
}

export function LiveMonitor({ examId }: { examId: string }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      try {
        const response = await fetch(`/api/admin/exams/${examId}/status`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Monitor request failed");
        const payload: unknown = await response.json();
        if (!isLiveStatus(payload)) throw new Error("Invalid monitor response");
        if (!cancelled) {
          setStatus(payload);
          setError(null);
        }
      } catch {
        if (!cancelled)
          setError("No se pudo actualizar el monitor. Se volverá a intentar.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [examId]);

  return (
    <div className="space-y-3">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {status ? (
        <p className="text-xs text-slate-500">
          Actualizado{" "}
          {new Date(status.serverNow).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          . Se actualiza cada 10 segundos.
        </p>
      ) : null}
      {status && status.attempts.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Alumno</Th>
              <Th>Intento</Th>
              <Th>Inicio</Th>
              <Th>Tiempo restante</Th>
              <Th>Foco</Th>
            </tr>
          </thead>
          <tbody>
            {status.attempts.map((attempt) => {
              const remaining = Math.max(
                0,
                Date.parse(attempt.deadlineAt) - Date.parse(status.serverNow),
              );
              return (
                <tr key={attempt.id}>
                  <Td>
                    <div className="font-medium text-slate-900">
                      {attempt.name ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500">{attempt.email}</div>
                  </Td>
                  <Td className="text-xs">{attempt.attemptNumber}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDateTime(new Date(attempt.startedAt))}
                  </Td>
                  <Td>
                    <Badge tone={remaining === 0 ? "red" : "amber"}>
                      {remaining === 0
                        ? "Tiempo agotado"
                        : formatCountdown(remaining)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {attempt.awayNow ? (
                      <Badge tone="red">Fuera ahora</Badge>
                    ) : null}{" "}
                    {attempt.focusLossCount > 0
                      ? `${attempt.focusLossCount} · ${formatDuration(attempt.focusLostMs)}`
                      : attempt.awayNow
                        ? ""
                        : "Sin salidas"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : status ? (
        <EmptyState title="No hay alumnos rindiendo">
          Los intentos activos aparecerán acá automáticamente.
        </EmptyState>
      ) : loading ? (
        <p className="text-sm text-slate-500">Cargando monitor…</p>
      ) : null}
    </div>
  );
}
