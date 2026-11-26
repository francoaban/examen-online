"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Alert, Button, Field, Input } from "@/components/ui";

type FormMode = "sign-in" | "sign-up";
type FormStep = "credentials" | "verification";

function isInvalidCredentialsError(error: unknown): boolean {
  const hasDetails = typeof error === "object" && error !== null;
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : hasDetails && "message" in error && typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";
  const status =
    hasDetails && "status" in error && typeof error.status === "number"
      ? error.status
      : undefined;

  return (
    status === 401 ||
    message.includes("invalid email or password") ||
    message.includes("invalid credentials")
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<FormMode>("sign-in");
  const [step, setStep] = useState<FormStep>("credentials");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "sign-up") {
        if (password.length < 12 || password.length > 128) {
          setError("Usá entre 12 y 128 caracteres para la contraseña.");
          return;
        }

        const { error: signUpError } = await authClient.signUp.email({
          email: normalizedEmail,
          name: name.trim(),
          password,
        });
        if (signUpError) {
          setError(signUpError.message || "No se pudo crear la cuenta.");
          return;
        }

        setStep("verification");
        setNotice(`Te enviamos un código de verificación a ${normalizedEmail}.`);
        return;
      }

      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        const message = signInError.message?.toLowerCase() ?? "";
        setError(
          signInError.status === 401 ||
            message.includes("invalid email or password") ||
            message.includes("invalid credentials")
            ? "Correo o contraseña incorrectos."
            : signInError.message || "No se pudo iniciar sesión.",
        );
        return;
      }

      window.location.assign("/bienvenida");
    } catch (error) {
      setError(
        isInvalidCredentialsError(error)
          ? "Correo o contraseña incorrectos."
          : "No se pudo completar la operación. Intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: verificationError } = await authClient.emailOtp.verifyEmail({
        email: normalizedEmail,
        otp: verificationCode.trim(),
      });
      if (verificationError) {
        setError(verificationError.message || "El código no es válido.");
        return;
      }

      const { error: signInError } = await authClient.signIn.email({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        setMode("sign-in");
        setStep("credentials");
        setNotice("Correo verificado. Iniciá sesión con tu contraseña.");
        return;
      }

      window.location.assign("/bienvenida");
    } catch {
      setError("No se pudo verificar el correo. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { error: resendError } =
        await authClient.emailOtp.sendVerificationOtp({
          email: email.trim().toLowerCase(),
          type: "email-verification",
        });
      if (resendError) {
        setError(resendError.message || "No se pudo reenviar el código.");
        return;
      }
      setNotice("Enviamos un nuevo código de verificación.");
    } catch {
      setError("No se pudo reenviar el código. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: FormMode) {
    setMode(nextMode);
    setStep("credentials");
    setError(null);
    setNotice(null);
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="red">{error}</Alert> : null}
      {notice ? <Alert tone="sky">{notice}</Alert> : null}

      {step === "verification" ? (
        <form className="space-y-4" onSubmit={verifyEmail}>
          <p className="text-sm text-slate-600">
            Ingresá el código que enviamos a <strong>{email}</strong>.
          </p>
          <Field label="Código de verificación" htmlFor="verification-code">
            <Input
              id="verification-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              required
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? "Verificando…" : "Verificar correo"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              disabled={busy}
              onClick={() => void resendVerificationCode()}
            >
              Reenviar código
            </Button>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          {mode === "sign-up" ? (
            <Field label="Nombre" htmlFor="signup-name">
              <Input
                id="signup-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </Field>
          ) : null}
          <Field label="Correo electrónico" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Contraseña"
            htmlFor="login-password"
            hint={mode === "sign-up" ? "Usá entre 12 y 128 caracteres." : undefined}
          >
            <Input
              id="login-password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={mode === "sign-up" ? 12 : undefined}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            className="w-full sm:w-auto"
            disabled={busy}
          >
            {busy
              ? mode === "sign-up"
                ? "Creando cuenta…"
                : "Ingresando…"
              : mode === "sign-up"
                ? "Crear cuenta"
                : "Ingresar"}
          </Button>
        </form>
      )}

      {step === "credentials" ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            {mode === "sign-in" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <button
              type="button"
              className="font-medium text-indigo-700 hover:text-indigo-900"
              onClick={() =>
                changeMode(mode === "sign-in" ? "sign-up" : "sign-in")
              }
            >
              {mode === "sign-in" ? "Registrate" : "Iniciá sesión"}
            </button>
          </p>
          {mode === "sign-in" ? (
            <Link
              href="/auth/reset-password"
              className="font-medium text-indigo-700 hover:text-indigo-900"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
