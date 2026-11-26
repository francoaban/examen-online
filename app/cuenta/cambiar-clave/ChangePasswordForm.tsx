"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (newPassword !== confirmation) {
        setError("Las contraseñas nuevas no coinciden.");
        return;
      }
      if (newPassword.length < 12 || newPassword.length > 128) {
        setError("Usá entre 12 y 128 caracteres para la contraseña nueva.");
        return;
      }

      const { error: changeError } = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (changeError) {
        setError(changeError.message || "No se pudo cambiar la contraseña.");
        return;
      }
      window.location.assign("/bienvenida");
    } catch {
      setError(
        "No se pudo cambiar la contraseña. Verificá la clave actual e intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Field label="Contraseña actual o temporal" htmlFor="current-password">
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </Field>
      <Field
        label="Nueva contraseña"
        htmlFor="new-password"
        hint="Debe tener entre 12 y 128 caracteres."
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </Field>
      <Field label="Repetí la nueva contraseña" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
        />
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
