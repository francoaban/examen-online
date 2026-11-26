"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutForm({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message || "No se pudo cerrar sesión.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("No se pudo cerrar sesión. Intentá de nuevo.");
    }
  }

  return (
    <form onSubmit={submit}>
      {children}
      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
