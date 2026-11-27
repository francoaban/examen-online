"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, okWithData, type ActionResult } from "@/lib/action-result";
import {
  displayNameFor,
  generateTemporaryPassword,
  parseStudentList,
  validatePasswordLength,
} from "@/lib/accounts/students";
import { authAdmin, type AdminApiError } from "@/lib/auth/admin";
import { isTeacherEmail } from "@/lib/config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";

/*
 * Alta de alumnos con contraseña temporal.
 *
 * Usa el plugin Admin de Neon Auth con la sesión del docente, así que su cuenta
 * tiene que tener el rol `admin` en Neon Auth (Console → Auth → Users, o
 * `neon neon-auth user set-role <id> --roles admin`). La cuenta se crea con el
 * email ya verificado y con `must_change_password = true`: el alumno solo puede
 * cambiar la contraseña hasta reemplazar la temporal.
 */

export type CreatedStudent = {
  email: string;
  name: string;
  status: "created" | "exists" | "skipped" | "error";
  /** Solo para `created`: se muestra una única vez al docente. */
  password?: string;
  message?: string;
};

type AuthError = AdminApiError | null;

const NOT_ADMIN_MESSAGE =
  "Tu cuenta no tiene el rol admin en Neon Auth, necesario para crear cuentas. " +
  "Asignalo desde Neon Console (Auth → Users) o con `neon neon-auth user set-role`.";

function isForbidden(error: AuthError): boolean {
  return error?.status === 401 || error?.status === 403;
}

function isAlreadyExists(error: AuthError): boolean {
  return /exist/i.test(`${error?.code ?? ""} ${error?.message ?? ""}`);
}

async function markMustChangePassword(email: string, name: string | null) {
  await db
    .insert(users)
    .values({ email, name, role: "student", mustChangePassword: true })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        mustChangePassword: true,
        name: sql`coalesce(${users.name}, excluded.name)`,
      },
    });
}

export async function createStudentAccounts(
  rawText: string,
  sharedPassword: string | null,
): Promise<ActionResult<{ results: CreatedStudent[] }>> {
  try {
    await assertTeacher();

    const parsed = parseStudentList(String(rawText ?? ""));
    if (!parsed.ok) return fail(parsed.error);

    const shared = sharedPassword?.trim() ? sharedPassword : null;
    if (shared) {
      const lengthError = validatePasswordLength(shared);
      if (lengthError) return fail(lengthError);
    }

    const results: CreatedStudent[] = [];
    for (const entry of parsed.value) {
      const name = displayNameFor(entry);

      if (isTeacherEmail(entry.email)) {
        results.push({
          email: entry.email,
          name,
          status: "skipped",
          message: "Es un correo docente (TEACHER_EMAILS).",
        });
        continue;
      }

      const password = shared ?? generateTemporaryPassword();
      const { error } = await authAdmin.createUser({
        email: entry.email,
        password,
        name,
        role: "user",
        data: { emailVerified: true },
      });

      if (error) {
        if (isForbidden(error)) return fail(NOT_ADMIN_MESSAGE);
        results.push(
          isAlreadyExists(error)
            ? {
                email: entry.email,
                name,
                status: "exists",
                message: "Ya tiene cuenta. Usá «Nueva clave temporal» si la necesita.",
              }
            : {
                email: entry.email,
                name,
                status: "error",
                message: error.message || "Neon Auth rechazó el alta.",
              },
        );
        continue;
      }

      await markMustChangePassword(entry.email, entry.name || null);
      results.push({ email: entry.email, name, status: "created", password });
    }

    revalidatePath("/admin/cuentas");
    return okWithData({ results });
  } catch (error) {
    logError("admin.createStudentAccounts", error);
    return fail("No se pudieron crear las cuentas. Revisá los registros del servidor.");
  }
}

const userIdSchema = z.string().uuid();

/**
 * Da una contraseña temporal nueva a un alumno (por ejemplo, si olvidó la
 * suya), cierra sus sesiones abiertas y lo obliga a cambiarla al ingresar.
 */
export async function resetStudentPassword(
  userId: string,
): Promise<ActionResult<{ email: string; password: string }>> {
  try {
    await assertTeacher();

    const parsedId = userIdSchema.safeParse(userId);
    if (!parsedId.success) return fail("Cuenta inválida.");

    const row = await db.query.users.findFirst({
      where: eq(users.id, parsedId.data),
    });
    if (!row) return fail("No se encontró la cuenta.");
    if (row.role !== "student" || isTeacherEmail(row.email)) {
      return fail("Solo se pueden restablecer cuentas de alumnos.");
    }

    const { data: listed, error: listError } = await authAdmin.listUsers({
      query: {
        searchField: "email",
        searchOperator: "contains",
        searchValue: row.email,
        limit: 10,
      },
    });
    if (listError) {
      if (isForbidden(listError)) return fail(NOT_ADMIN_MESSAGE);
      return fail(listError.message || "No se pudo consultar Neon Auth.");
    }

    const authUser = (listed?.users ?? []).find(
      (candidate) => candidate.email?.toLowerCase() === row.email,
    );
    if (!authUser) return fail("La cuenta no existe en Neon Auth.");

    const password = generateTemporaryPassword();
    const { error: setError } = await authAdmin.setUserPassword({
      userId: authUser.id,
      newPassword: password,
    });
    if (setError) {
      if (isForbidden(setError)) return fail(NOT_ADMIN_MESSAGE);
      return fail(setError.message || "No se pudo cambiar la contraseña.");
    }

    // Que la contraseña anterior (o una sesión robada) no siga sirviendo.
    const { error: revokeError } = await authAdmin.revokeUserSessions({
      userId: authUser.id,
    });
    if (revokeError) logError("admin.resetStudentPassword.revoke", revokeError);

    await db
      .update(users)
      .set({ mustChangePassword: true })
      .where(eq(users.id, row.id));

    revalidatePath("/admin/cuentas");
    return okWithData({ email: row.email, password });
  } catch (error) {
    logError("admin.resetStudentPassword", error);
    return fail("No se pudo restablecer la contraseña. Revisá los registros del servidor.");
  }
}
