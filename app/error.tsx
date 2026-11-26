"use client";

import { RouteError } from "@/components/RouteError";

export default function Error({
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
      title="No se pudo cargar esta página."
      description="Ocurrió un error inesperado. Podés volver a intentarlo."
    />
  );
}
