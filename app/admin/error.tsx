"use client";

import { RouteError } from "@/components/RouteError";

export default function AdminError({
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
      title="No se pudo cargar el panel docente."
      description="El panel encontró un problema. Volvé a intentarlo."
    />
  );
}
