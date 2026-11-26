export type ActionFailure = { ok: false; error: string };

export type ActionResult<T = void> =
  | ActionFailure
  | (T extends void ? { ok: true } : { ok: true; data: T });

export function ok(): { ok: true } {
  return { ok: true };
}

export function okWithData<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(error: string): ActionFailure {
  return { ok: false, error };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}
