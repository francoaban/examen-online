import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, events } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/guards";
import { fail, json, readJsonBody } from "@/lib/http";
import { recordEventsSchema } from "@/lib/api/attempt-schemas";
import {
  closeFocusLoss,
  focusTransitionFor,
  recordFocusLoss,
} from "@/lib/exam/focus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "heartbeat",
  "hidden",
  "visible",
  "blur",
  "focus",
  "pagehide",
  "copy",
  "paste",
  "fullscreen_exit",
]);

/**
 * Registro de auditoría. La hora SIEMPRE la pone el servidor:
 * el reloj del cliente no es evidencia válida.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return fail("Sesión no válida.", 401);

  const attempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)),
    columns: { id: true },
  });
  if (!attempt) return fail("Intento inexistente.", 404);

  const parsedBody = recordEventsSchema.safeParse(await readJsonBody(req));
  if (!parsedBody.success) return fail("Cuerpo inválido.", 400);
  const body = parsedBody.data;

  const incoming = Array.isArray(body.events)
    ? body.events
    : body.type
      ? [{ type: body.type, meta: body.meta }]
      : [];

  if (incoming.length === 0) return json({ ok: true, stored: 0 });
  if (incoming.length > 50) return fail("Demasiados eventos.", 413);

  const rows = incoming
    .filter(
      (event): event is typeof event & { type: string } =>
        typeof event.type === "string" && ALLOWED_TYPES.has(event.type),
    )
    .slice(0, 50)
    .map((e) => ({
      attemptId: attempt.id,
      type: e.type,
      meta: e.meta ?? null,
    }));

  if (rows.length === 0) return json({ ok: true, stored: 0 });

  await db.insert(events).values(rows);

  // Contadores de foco: se aplican en orden, solo en las transiciones.
  // Eventos consecutivos del mismo tipo (p. ej. hidden + blur) se colapsan.
  let last: "loss" | "return" | null = null;
  for (const row of rows) {
    const transition = focusTransitionFor(row.type, row.meta);
    if (!transition || transition === last) continue;
    last = transition;
    if (transition === "loss") await recordFocusLoss(attempt.id);
    else await closeFocusLoss(attempt.id);
  }

  return json({ ok: true, stored: rows.length }, 201);
}
