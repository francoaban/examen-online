/** Nombre visible de la aplicación. */
export const APP_NAME = "Mi Examen Online";

/** Autor y desarrollador del proyecto (licencia MIT: conservar este crédito). */
export const APP_AUTHOR = "Franco Emanuel Aban Tejerina";

/** Emails con rol docente, definidos por variable de entorno. */
export const TEACHER_EMAILS: string[] = (process.env.TEACHER_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isTeacherEmail(email: string): boolean {
  return TEACHER_EMAILS.includes(email.trim().toLowerCase());
}

/** Cada cuánto el cliente manda señal de vida (ms). */
export const HEARTBEAT_MS = 25_000;

/** Tolerancia de red al enviar sobre el deadline (segundos). */
export const SUBMIT_GRACE_SECONDS = 20;

/** Debounce del autoguardado de respuestas (ms). */
export const AUTOSAVE_DEBOUNCE_MS = 700;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
