"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { examStudents, users } from "@/lib/db/schema";
import { errorMessage, fail, okWithData } from "@/lib/action-result";
import { validateRosterEmails } from "@/lib/exam/validators";
import { assertTeacher } from "@/lib/guards";
import { logError } from "@/lib/logger";
import type { ActionResult } from "../types";

/* -------------------------------------------------------------------------- */
/*  Roster                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveRoster(
  examId: string,
  rawText: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    await assertTeacher();

    const parsed = validateRosterEmails(rawText);
    if (!parsed.ok) return fail(parsed.error);
    const unique = parsed.value;

    await db.transaction(async (tx) => {
      await tx.delete(examStudents).where(eq(examStudents.examId, examId));
      if (unique.length > 0) {
        for (let i = 0; i < unique.length; i += 500) {
          await tx
            .insert(examStudents)
            .values(
              unique
                .slice(i, i + 500)
                .map((email) => ({ examId, email })),
            )
            .onConflictDoNothing();
        }
      }
    });

    revalidatePath(`/admin/exams/${examId}`);
    return okWithData({ count: unique.length });
  } catch (error) {
    logError("admin.saveRoster", error);
    return fail(errorMessage(error));
  }
}

/** Lista de alumnos registrados, para autocompletar el roster. */
export async function knownStudents(): Promise<string[]> {
  await assertTeacher();
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "student"))
    .limit(2000);
  return rows.map((row) => row.email);
}
