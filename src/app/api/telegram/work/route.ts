import { timingSafeEqual } from "node:crypto";
import { json } from "@/lib/api/errors";
import { workPending } from "@/lib/bot/classroom";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Each run stays inside its own budget (about 20 seconds of Codeforces checks), leaving room under the platform limit.
export const maxDuration = 60;

/** Only the scheduler holds CRON_SECRET, so only it can start a run. Compared in constant time. */
function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 32 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/telegram/work. Call it every minute from the scheduler, with Authorization: Bearer <CRON_SECRET>. */
export async function POST(request: Request) {
  if (!authorised(request.headers.get("authorization"))) return new Response(null, { status: 401 });
  return json(await workPending(new Date(), 20_000));
}
