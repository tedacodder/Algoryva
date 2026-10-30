import { ApiError } from "@/lib/api/errors";

/**
 * The origin used to build link URLs. Must be https, except plain http on localhost for development. Refuses anything else so
 * a misconfigured deployment can never hand out a link that points somewhere other than the website.
 */
export function siteOrigin(env: { readonly SITE_URL?: string; readonly [key: string]: string | undefined } = process.env): string {
  const fail = () => new ApiError(503, "bot_api_misconfigured", "The bot API is not configured.");
  if (!env.SITE_URL) throw fail();
  let url: URL;
  try { url = new URL(env.SITE_URL); } catch { throw fail(); }
  const localDev = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !localDev) throw fail();
  if (url.pathname !== "/" || url.search || url.hash) throw fail();
  return url.origin;
}
