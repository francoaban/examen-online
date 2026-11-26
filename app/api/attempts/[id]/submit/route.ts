import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/guards";
import { fail, json } from "@/lib/http";
import { finalizeAttempt } from "@/lib/exam/attempts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await ctx.params;

  const user = await getSessionUser();
  if (!user) return fail("Sesión no válida.", 401);

  const attempt = await db.query.attempts.findFirst({
    where: and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)),
  });
  if (!attempt) return fail("Intento inexistente.", 404);

  if (attempt.submittedAt != null) {
    return json({ ok: true, alreadySubmitted: true });
  }

  const result = await finalizeAttempt(attempt.id);

  return json({ ok: true, score: result?.totalScore ?? 0 });
}
