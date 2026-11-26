"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth/client";

type ResetStep = "request" | "reset";

export function PasswordResetForm() {
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { error: requestError } =
        await authClient.forgetPassword.emailOtp({
          email: email.trim().toLowerCase(),
        });
      if (requestError) {
        setError(requestError.message || "No se pudo solicitar el código.");
        return;
      }

      setStep("reset");
      setNotice("Si el correo está registrado, recibirás un código de recuperación.");
    } catch {
      setError("No se pudo solicitar el código. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (password !== confirmation) {
        setError("Las contraseñas nuevas no coinciden.");
        return;
      }
      if (password.length < 12 || password.length > 128) {
        setError("Usá entre 12 y 128 caracteres para la contraseña.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { data: verification, error: verificationError } =
        await authClient.emailOtp.checkVerificationOtp({
          email: normalizedEmail,
          otp: code.trim(),
          type: "forget-password",
        });
      if (verificationError) {
        setError(verificationError.message || "El código no es válido.");
        return;
      }
      if (!verification?.success) {
        setError("El código no es válido o venció.");
        return;
      }

      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email: normalizedEmail,
        otp: code.trim(),
        password,
      });
      if (resetError) {
        setError(resetError.message || "No se pudo cambiar la contraseña.");
        return;
      }

      window.location.assign("/");
    } catch {
      setError("No se pudo restablecer la contraseña. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {notice ? <Alert tone="sky">{notice}</Alert> : null}

      {step === "request" ? (
        <form className="space-y-4" onSubmit={requestCode}>
          <Field label="Correo electrónico" htmlFor="reset-email">
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Enviando…" : "Enviar código"}
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={resetPassword}>
          <p className="text-sm text-slate-600">
            Ingresá el código que enviamos a <strong>{email}</strong>.
          </p>
          <Field label="Código de recuperación" htmlFor="reset-code">
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Nueva contraseña"
            htmlFor="reset-password"
            hint="Usá entre 12 y 128 caracteres."
          >
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Repetí la contraseña" htmlFor="reset-confirmation">
            <Input
              id="reset-confirmation"
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
            {busy ? "Guardando…" : "Restablecer contraseña"}
          </Button>
        </form>
      )}

      <p className="text-sm">
        <Link
          href="/"
          className="font-medium text-indigo-700 hover:text-indigo-900"
        >
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}
