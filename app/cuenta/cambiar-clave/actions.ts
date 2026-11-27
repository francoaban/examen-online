"use server";

import { eq } from "drizzle-orm";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { validatePasswordLength } from "@/lib/accounts/students";
import { sessionReader } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/guards";
import { logError } from "@/lib/logger";

/**
 * Cambia la contraseña desde el servidor para que la marca de "contraseña
 * temporal" solo se apague si Neon Auth aceptó el cambio (el cliente no puede
 * apagarla por su cuenta). Cierra además las otras sesiones abiertas.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) return fail("Tu sesión venció. Volvé a iniciar sesión.");

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return fail("Datos inválidos.");
    }
    const lengthError = validatePasswordLength(newPassword);
    if (lengthError) return fail(lengthError);
    if (newPassword === currentPassword) {
      return fail("La contraseña nueva tiene que ser distinta de la actual.");
    }

    const { error } = await sessionReader.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      const invalid =
        error.status === 400 ||
        error.status === 401 ||
        /invalid password/i.test(error.message ?? "");
      return fail(
        invalid
          ? "La contraseña actual no es correcta."
          : "No se pudo cambiar la contraseña. Intentá de nuevo.",
      );
    }

    if (user.mustChangePassword) {
      await db
        .update(users)
        .set({ mustChangePassword: false })
        .where(eq(users.id, user.id));
    }
    return ok();
  } catch (error) {
    logError("account.changeOwnPassword", error);
    return fail("No se pudo cambiar la contraseña. Intentá de nuevo.");
  }
}
