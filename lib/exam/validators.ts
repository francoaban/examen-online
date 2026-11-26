import { normalizeEmail } from "@/lib/config";
import { fromArgLocalInput, slugify } from "@/lib/utils";
import type { ExamInput } from "./types";

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type ValidatedExam = {
  title: string;
  slug: string;
  description: string | null;
  opensAt: Date;
  closesAt: Date;
  durationMinutes: number | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  warnAfterSeconds: number;
  maxWarnings: number;
  showScoreOnSubmit: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateExamInput(
  input: ExamInput,
): ValidationResult<ValidatedExam> {
  const title = (input.title ?? "").trim();
  if (title.length < 3)
    return { ok: false, error: "El título debe tener al menos 3 caracteres." };

  const opensAt = fromArgLocalInput(input.opensAt ?? "");
  const closesAt = fromArgLocalInput(input.closesAt ?? "");
  if (!opensAt || !closesAt)
    return {
      ok: false,
      error: "Las fechas de apertura y cierre son obligatorias.",
    };
  if (closesAt.getTime() <= opensAt.getTime())
    return {
      ok: false,
      error: "El cierre tiene que ser posterior a la apertura.",
    };

  let durationMinutes: number | null = null;
  if (input.durationMinutes != null) {
    durationMinutes = Math.round(Number(input.durationMinutes));
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > 600
    )
      return {
        ok: false,
        error: "La duración debe estar entre 1 y 600 minutos (o sin límite).",
      };
  }

  const maxAttempts = Math.round(Number(input.maxAttempts ?? 1));
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1 || maxAttempts > 20)
    return {
      ok: false,
      error: "La cantidad de intentos debe estar entre 1 y 20.",
    };

  const warnAfterSeconds = Math.min(
    600,
    Math.max(0, Math.round(Number(input.warnAfterSeconds) || 0)),
  );
  const maxWarnings = Math.min(
    50,
    Math.max(0, Math.round(Number(input.maxWarnings) || 0)),
  );
  const slug = slugify(input.slug?.trim() || title) || `examen-${Date.now()}`;

  return {
    ok: true,
    value: {
      title,
      slug,
      description: (input.description ?? "").trim() || null,
      opensAt,
      closesAt,
      durationMinutes,
      maxAttempts,
      shuffleQuestions: Boolean(input.shuffleQuestions),
      shuffleOptions: Boolean(input.shuffleOptions),
      warnAfterSeconds,
      maxWarnings,
      showScoreOnSubmit: Boolean(input.showScoreOnSubmit),
    },
  };
}

export function validateRosterEmails(rawText: string): ValidationResult<string[]> {
  const tokens = (rawText ?? "")
    .split(/[\s,;]+/)
    .map((token) => normalizeEmail(token))
    .filter(Boolean);

  const unique = [...new Set(tokens)];
  const invalid = unique.filter((email) => !EMAIL_RE.test(email));
  if (invalid.length > 0)
    return {
      ok: false,
      error: `Emails inválidos: ${invalid.slice(0, 5).join(", ")}${
        invalid.length > 5 ? "…" : ""
      }`,
    };

  return { ok: true, value: unique };
}
