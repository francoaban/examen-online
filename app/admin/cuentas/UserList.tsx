"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button } from "@/components/ui";
import { resetStudentPassword } from "../actions/accounts";

type Account = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
};

function ResetPasswordButton({ account }: { account: Account }) {
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    if (
      !window.confirm(
        `¿Dar una contraseña temporal nueva a ${account.email}? Se cerrarán sus sesiones abiertas.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPassword(account.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword(result.data.password);
    });
  }

  if (password) {
    return (
      <p className="text-xs text-slate-600">
        Nueva clave temporal:{" "}
        <span className="font-mono text-sm text-slate-900">{password}</span>
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={reset}>
        {pending ? "Generando…" : "Nueva clave temporal"}
      </Button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function UserList({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Todavía no hay usuarios registrados.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-200">
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {account.name || account.email}
              </p>
              {account.name ? (
                <p className="truncate text-xs text-slate-500">{account.email}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {account.mustChangePassword ? (
                <Badge tone="amber">Clave temporal pendiente</Badge>
              ) : null}
              <Badge tone={account.role === "teacher" ? "emerald" : "sky"}>
                {account.role === "teacher" ? "Docente" : "Alumno"}
              </Badge>
              {account.role === "student" ? (
                <ResetPasswordButton account={account} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Alert tone="slate">
        «Nueva clave temporal» reemplaza la contraseña del alumno, cierra sus sesiones
        y lo obliga a elegir una propia al ingresar.
      </Alert>
    </div>
  );
}
