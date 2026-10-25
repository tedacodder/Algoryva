/**
 * One error shape for the whole mobile API: { error: { code, message } }. Messages are written for the app's users
 * and never echo request values (passwords, tokens, emails), and unexpected errors never leak their message.
 */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly headers: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
  }
}

/** Authenticated, sync, submission and auth responses must never be stored by a cache. */
export const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE, ...headers } });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status, e.headers);
  // Log the error class and Prisma code only. Messages can carry query parameters, emails or other request data.
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  console.error("[api] unexpected error:", e instanceof Error ? e.name : typeof e, code);
  return json({ error: { code: "internal", message: "Something went wrong. Try again." } }, 500);
}

/** Wraps a route handler so every thrown error becomes the standard error body. */
export function handle(fn: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    try { return await fn(request); } catch (e) { return errorResponse(e); }
  };
}
