export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/** Argentina no tiene horario de verano: UTC-3 fijo. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;
const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: AR_TIME_ZONE,
  }).format(date);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: AR_TIME_ZONE,
  }).format(date);
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeStyle: "medium",
    timeZone: AR_TIME_ZONE,
  }).format(date);
}

/** mm:ss, o h:mm:ss si supera la hora. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/** Duración legible: "45 s", "3 min 20 s", "1 h 05 min". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  return `${seconds} s`;
}

/** "60 min" o "Sin límite" según la duración configurada. */
export function formatExamDuration(minutes: number | null | undefined): string {
  return minutes == null ? "Sin límite" : `${minutes} min`;
}

export function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

/**
 * Fecha ISO -> valor para <input type="datetime-local"> en hora argentina.
 * Se calcula en el servidor para que no haya diferencias de hidratación.
 */
export function toArgLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - AR_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** Valor de <input type="datetime-local"> (hora argentina) -> Date. */
export function fromArgLocalInput(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}:00.000-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
