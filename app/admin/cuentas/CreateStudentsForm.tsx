"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button, Field, Input, Table, Td, Textarea, Th } from "@/components/ui";
import { serializeCsv } from "@/lib/csv";
import { createStudentAccounts, type CreatedStudent } from "../actions/accounts";

const STATUS_LABEL: Record<CreatedStudent["status"], string> = {
  created: "Creada",
  exists: "Ya existía",
  skipped: "Omitida",
  error: "Error",
};

const STATUS_TONE = {
  created: "emerald",
  exists: "amber",
  skipped: "slate",
  error: "red",
} as const;

function downloadCredentials(results: CreatedStudent[]) {
  const rows = results
    .filter((row) => row.status === "created")
    .map((row) => [row.email, row.name, row.password ?? ""]);
  const csv = serializeCsv([["email", "nombre", "contraseña_temporal"], ...rows]);
  const url = URL.createObjectURL(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `credenciales-alumnos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CreateStudentsForm() {
  const [list, setList] = useState("");
  const [useShared, setUseShared] = useState(false);
  const [sharedPassword, setSharedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CreatedStudent[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createStudentAccounts(
        list,
        useShared ? sharedPassword : null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setResults(result.data.results);
      setList("");
      setSharedPassword("");
    });
  }

  const created = results?.filter((row) => row.status === "created") ?? [];

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={submit}>
        {error ? <Alert tone="red">{error}</Alert> : null}
        <Field
          label="Alumnos"
          htmlFor="students-list"
          hint="Uno por línea: email, o email y nombre separados por coma, punto y coma o tabulación (se puede pegar desde una planilla). Hasta 100 por vez."
        >
          <Textarea
            id="students-list"
            rows={6}
            value={list}
            onChange={(event) => setList(event.target.value)}
            placeholder={"ana.perez@ejemplo.com, Ana Pérez\nbeto.gomez@ejemplo.com, Beto Gómez"}
            required
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={useShared}
            onChange={(event) => setUseShared(event.target.checked)}
          />
          Usar la misma contraseña temporal para todos
        </label>
        {useShared ? (
          <Field
            label="Contraseña temporal"
            htmlFor="shared-password"
            hint="Entre 12 y 128 caracteres. Si no la marcás, se genera una distinta para cada alumno (recomendado)."
          >
            <Input
              id="shared-password"
              type="text"
              autoComplete="off"
              minLength={12}
              maxLength={128}
              value={sharedPassword}
              onChange={(event) => setSharedPassword(event.target.value)}
              required
            />
          </Field>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Creando cuentas…" : "Habilitar alumnos"}
        </Button>
      </form>

      {results ? (
        <div className="space-y-3">
          {created.length > 0 ? (
            <Alert tone="amber" title="Guardá las contraseñas ahora">
              Se muestran una sola vez. Al ingresar, cada alumno tiene que
              reemplazarla por una propia antes de ver sus exámenes.
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {created.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadCredentials(results)}
              >
                Descargar CSV de credenciales
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => setResults(null)}>
              Ocultar
            </Button>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Alumno</Th>
                <Th>Estado</Th>
                <Th>Contraseña temporal</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.email}>
                  <Td>
                    <p className="text-sm text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.email}</p>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    {row.message ? (
                      <p className="mt-1 text-xs text-slate-500">{row.message}</p>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-sm">{row.password ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
