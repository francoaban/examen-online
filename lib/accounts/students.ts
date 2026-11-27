import { randomInt } from "node:crypto";
import { normalizeEmail } from "@/lib/config";

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type StudentEntry = { email: string; name: string };

/** Máximo de cuentas por envío: cada alta es una llamada a Neon Auth. */
export const MAX_STUDENTS_PER_BATCH = 100;

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Una línea por alumno: `email` o `email, Nombre Apellido` (también con `;` o
 * tabulación, para pegar desde una planilla). Ignora líneas vacías y una
 * primera fila de encabezado sin `@`.
 */
export function parseStudentList(rawText: string): ValidationResult<StudentEntry[]> {
  const lines = (rawText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 0 && !lines[0]!.includes("@")) lines.shift();

  const byEmail = new Map<string, StudentEntry>();
  const invalid: string[] = [];

  for (const line of lines) {
    const [first = "", ...rest] = line.split(/[,;\t]/);
    const email = normalizeEmail(first.replace(/^["']|["']$/g, ""));
    const name = rest
      .join(" ")
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    if (!EMAIL_RE.test(email)) {
      invalid.push(first.trim() || line);
      continue;
    }
    if (!byEmail.has(email)) byEmail.set(email, { email, name });
  }

  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Emails inválidos: ${invalid.slice(0, 5).join(", ")}${
        invalid.length > 5 ? "…" : ""
      }`,
    };
  }

  const entries = [...byEmail.values()];
  if (entries.length === 0) return { ok: false, error: "La lista está vacía." };
  if (entries.length > MAX_STUDENTS_PER_BATCH) {
    return {
      ok: false,
      error: `Se pueden habilitar hasta ${MAX_STUDENTS_PER_BATCH} alumnos por vez (la lista tiene ${entries.length}).`,
    };
  }
  return { ok: true, value: entries };
}

export function validatePasswordLength(password: string): string | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`;
  }
  return null;
}

/** Sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I). */
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Contraseña temporal de 14 caracteres (`xxxx-xxxx-xxxx`, ~70 bits de
 * entropía), generada con el CSPRNG de Node. Solo sirve para el primer ingreso:
 * el alumno queda obligado a cambiarla.
 */
export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = "";
    for (let i = 0; i < 4; i++) {
      group += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Nombre a mostrar cuando la lista no lo trae: la parte local del email. */
export function displayNameFor(entry: StudentEntry): string {
  return entry.name || entry.email.split("@")[0] || entry.email;
}
