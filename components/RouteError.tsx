"use client";

import { useEffect } from "react";
import { Button, Card, CardBody } from "@/components/ui";

type Props = {
  error: unknown;
  retry: () => void;
  title: string;
  description: string;
};

export function RouteError({ error, retry, title, description }: Props) {
  useEffect(() => {
    console.error("Falló la carga de una página.", error);
  }, [error]);

  const digest =
    error && typeof error === "object" && "digest" in error
      ? error.digest
      : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-12">
      <Card className="w-full">
        <CardBody className="space-y-4">
          <div className="space-y-2" role="alert">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">{description}</p>
            {typeof digest === "string" ? (
              <p className="text-xs text-slate-500">
                Código de referencia: <span className="font-mono">{digest}</span>
              </p>
            ) : null}
          </div>
          <Button onClick={retry}>Reintentar</Button>
        </CardBody>
      </Card>
    </main>
  );
}
