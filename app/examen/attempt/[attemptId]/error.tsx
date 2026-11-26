"use client";

import { RouteError } from "@/components/RouteError";

export default function AttemptError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <RouteError
      error={error}
      retry={retry}
      title="No se pudo cargar el examen."
      description="Ocurrió un problema al abrir el intento. Volvé a intentarlo y, si persiste, contactá al docente."
    />
  );
}
