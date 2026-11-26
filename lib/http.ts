export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400, extra?: unknown): Response {
  return Response.json({ error: message, ...(extra as object) }, { status });
}

/** Lee el cuerpo como JSON tolerando text/plain (sendBeacon). */
export async function readJsonBody(req: Request): Promise<unknown | null> {
  try {
    const raw = await req.text();
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
