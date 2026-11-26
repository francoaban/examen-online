"use client";

import "./globals.css";
import { RouteError } from "@/components/RouteError";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        <RouteError
          error={error}
          retry={retry}
          title="No se pudo iniciar la aplicación."
          description="Ocurrió un error inesperado. Podés volver a intentarlo."
        />
      </body>
    </html>
  );
}
