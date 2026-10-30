import "server-only";
import { db } from "@/lib/db";

/**
 * The stored outcome of one submission, looked up by the client's id. Only the caller's own submissions are reachable, because
 * the key includes the user id. Returns null when there is no such submission for this user.
 */
export async function submissionStatus(userId: string, clientId: string) {
  const event = await db.syncEvent.findUnique({ where: { userId_id: { userId, id: clientId } }, select: { type: true, outcome: true } });
  if (!event || event.type !== "submission") return null;
  const o = (event.outcome ?? {}) as Record<string, unknown>;
  if (o.status === "pending") return { status: "pending" as const };
  return {
    status: "done" as const,
    verdict: typeof o.verdict === "string" ? o.verdict : "not_recorded",
    allPass: o.allPass === true,
    solved: o.solved === true,
    ...(typeof o.note === "string" ? { note: o.note } : {}),
  };
}
