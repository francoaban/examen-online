import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { sessionReader } from "@/lib/auth/server";
import { isTeacherEmail, normalizeEmail } from "@/lib/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  /** Cuenta creada por un docente con contraseña temporal que aún no se cambió. */
  mustChangePassword: boolean;
};

/** Página a la que se envía a quien todavía tiene una contraseña temporal. */
export const CHANGE_PASSWORD_PATH = "/cuenta/cambiar-clave";

function canUseUnverifiedTestEmail(email: string): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_UNVERIFIED_TEST_EMAILS === "true" &&
    email.endsWith("@example.test")
  );
}

/**
 * Errores de Neon Auth que significan "la sesión de la cookie ya no es válida"
 * (p. ej. el usuario fue eliminado o se reseteó la branch): se tratan como
 * "sin sesión" en lugar de romper la página con un 500.
 */
function isInvalidSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code } = error as { status?: number; code?: string };
  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    code === "user_not_found" ||
    code === "session_not_found"
  );
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data: session, error } = await sessionReader.getSession();
  if (error) {
    if (isInvalidSessionError(error)) return null;
    throw error;
  }

  const authUser = session?.user;
  if (!authUser?.email) return null;

  const email = normalizeEmail(authUser.email);
  if (!authUser.emailVerified && !canUseUnverifiedTestEmail(email)) return null;
  const expectedRole = isTeacherEmail(email) ? "teacher" : "student";

  let row = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!row) {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: authUser.name || null,
        role: expectedRole,
        mustChangePassword: false,
      })
      .onConflictDoNothing()
      .returning();
    row =
      created ??
      (await db.query.users.findFirst({ where: eq(users.email, email) }));
  }

  if (!row) throw new Error("No se pudo crear el perfil de la cuenta autenticada.");

  // `mustChangePassword` lo activa el docente al crear la cuenta o al dar una
  // contraseña temporal nueva, y solo lo apaga `changeOwnPassword`.
  const updates: Partial<typeof users.$inferInsert> = {};
  if (row.role !== expectedRole) updates.role = expectedRole;
  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, row.id));
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: expectedRole,
    mustChangePassword: row.mustChangePassword,
  };
}

/**
 * Para route handlers: `null` si no hay sesión o si la cuenta todavía tiene la
 * contraseña temporal (no puede rendir ni administrar hasta cambiarla).
 */
export async function getActiveSessionUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return null;
  return user;
}

export async function requireUser(
  options: { allowPendingPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.mustChangePassword && !options.allowPendingPasswordChange) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  return user;
}

export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "teacher") redirect("/mis-examenes");
  return user;
}

/** Para server actions y API routes: lanza en lugar de redirigir. */
export async function assertTeacher(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("No autenticado");
  if (user.mustChangePassword) throw new Error("Cambiá la contraseña temporal antes de continuar.");
  if (user.role !== "teacher") throw new Error("No autorizado");
  return user;
}
