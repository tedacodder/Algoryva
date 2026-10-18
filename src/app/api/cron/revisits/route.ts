import { runRevisitDigests } from "@/lib/revisit-store";

export const dynamic = "force-dynamic";

/**
 * Called once a day by Vercel Cron. Vercel sends "Authorization: Bearer <CRON_SECRET>", so anyone else gets a 401.
 * Without CRON_SECRET set, every request is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runRevisitDigests(new Date(), 200);
  return Response.json(result);
}
