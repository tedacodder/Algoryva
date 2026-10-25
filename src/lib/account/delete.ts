import "server-only";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" | "invalid_password" | "last_admin" };

/** The AuthAttempt keys that belong to one account (see src/app, `key:` and `record(` call sites). IP-keyed rows are not linked to an account. */
export function authAttemptKeysFor(user: { id: string; email: string; pendingEmail: string | null }): { exact: string[]; checkPrefix: string } {
  const emails = [user.email, ...(user.pendingEmail ? [user.pendingEmail] : [])];
  return {
    exact: [
      ...emails.flatMap((e) => [`login-email:${e}`, `register-email:${e}`, `forgot-email:${e}`]),
      `verify:${user.id}`, `email-change:${user.id}`,
      `delete-account:${user.id}`, `v1-logout:${user.id}`, `v1-push:${user.id}`, `v1-read:${user.id}`, `v1-submit:${user.id}`,
    ],
    checkPrefix: `check:${user.id}:`,
  };
}

/**
 * The one deletion routine, used by DELETE /api/v1/me and by the website's /delete-account action. The caller has already
 * authenticated the session and applied the rate limit. This re-checks the password, then in a single transaction removes
 * the account's AuthAttempt rows and the user row. Everything else (sessions, progress, notes, mistakes, revisits, solves,
 * quiz results, activity, tokens, contest entries, submissions, sync events) goes with it through ON DELETE CASCADE
 * foreign keys, verified in prisma/migrations. After this, no session row exists, so every token and cookie is dead.
 *
 * Last-admin guard: when the account is an ADMIN, all admin rows are locked (SELECT ... FOR UPDATE) before they are counted,
 * so two admins deleting themselves at the same moment are serialised and the second one sees that it is the last.
 */
export async function deleteAccount(userId: string, password: string): Promise<DeleteResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, pendingEmail: true, passwordHash: true, role: true } });
  if (!user) return { ok: false, reason: "not_found" };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, reason: "invalid_password" };
  const keys = authAttemptKeysFor(user);
  try {
    return await db.$transaction(async (tx): Promise<DeleteResult> => {
      if (user.role === "ADMIN") {
        const admins = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' FOR UPDATE`;
        if (admins.some((a) => a.id === user.id) && admins.length <= 1) return { ok: false, reason: "last_admin" };
      }
      await tx.authAttempt.deleteMany({ where: { OR: [{ key: { in: keys.exact } }, { key: { startsWith: keys.checkPrefix } }] } });
      await tx.user.delete({ where: { id: user.id } });
      return { ok: true };
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025") return { ok: false, reason: "not_found" }; // deleted by a concurrent request
    throw e;
  }
}
