import { errorResponse } from "@/lib/api/errors";
import { etagMatches, getContent } from "@/lib/mobile/content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public and identical for everyone, so it may be cached by a shared cache. Admin edits can take up to a minute to reach the edge
// (s-maxage) and, with the five-minute server cache, a few minutes in total. Clients revalidate with If-None-Match.
const PUBLIC_CACHE = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/** GET /api/v1/content. Never reads cookies or Authorization, never sets cookies, and the ETag depends only on the body. */
export async function GET(request: Request): Promise<Response> {
  try {
    const { body, etag } = await getContent();
    const headers = { ETag: etag, "Cache-Control": PUBLIC_CACHE };
    if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
    return new Response(body, { status: 200, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  } catch (e) {
    return errorResponse(e);
  }
}
