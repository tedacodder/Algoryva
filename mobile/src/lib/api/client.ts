import type {
  AuthResponse, ContentResponse, MeResponse, PullResponse, PushResponse, SubmissionRequest, SubmissionResponse, SyncEventInput, ApiErrorBody,
} from "./types";

/**
 * A small typed client for /api/v1. It has no React Native imports, so it runs in Node tests unchanged.
 *
 *  - Adds `Authorization: Bearer <token>` when a token is available (never to /content, which is public).
 *  - Turns every failure into one of two classes: ApiError (the server answered; code and message from the server's
 *    `{ error: { code, message } }`) or NetworkError (no answer: offline, DNS, TLS, timeout). Callers can handle offline
 *    differently from a rejected request.
 *  - On 401 for a request that sent a token, calls onUnauthorized once (the caller clears the stored token) and throws.
 *  - Times out every request, so a stalled connection cannot freeze the UI.
 */

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(readonly reason: "timeout" | "unreachable") {
    super(reason === "timeout" ? "The server took too long to respond." : "Could not reach the server. Check your connection.");
    this.name = "NetworkError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void | Promise<void>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

type Method = "GET" | "POST" | "DELETE";
type RequestOptions = { body?: unknown; auth?: boolean; query?: Record<string, string | undefined>; headers?: Record<string, string> };

const DEFAULT_TIMEOUT_MS = 15_000;

export function createApiClient(opts: ApiClientOptions) {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function send(method: Method, path: string, o: RequestOptions = {}): Promise<{ status: number; body: unknown; headers: Headers; sentToken: boolean }> {
    const url = new URL(opts.baseUrl + path);
    for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

    const headers: Record<string, string> = { Accept: "application/json", ...(o.headers ?? {}) };
    if (o.body !== undefined) headers["Content-Type"] = "application/json";
    const token = o.auth ? opts.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url.toString(), {
        method,
        headers,
        ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (e) {
      const aborted = controller.signal.aborted || (e instanceof Error && e.name === "AbortError");
      throw new NetworkError(aborted ? "timeout" : "unreachable");
    } finally {
      clearTimeout(timer);
    }

    let body: unknown = null;
    const text = await res.text();
    if (text.length > 0) {
      try { body = JSON.parse(text); } catch { body = null; }
    }
    return { status: res.status, body, headers: res.headers, sentToken: Boolean(token) };
  }

  /** Converts a non-2xx response into an ApiError, and signs out when the server rejects a token that was sent. */
  async function ensureOk(r: { status: number; body: unknown; sentToken: boolean }): Promise<void> {
    if (r.status >= 200 && r.status < 300) return;
    const err = (r.body as Partial<ApiErrorBody> | null)?.error;
    const code = typeof err?.code === "string" ? err.code : `http_${r.status}`;
    const message = typeof err?.message === "string" ? err.message : "The request failed.";
    if (r.status === 401 && r.sentToken) await opts.onUnauthorized?.();
    throw new ApiError(r.status, code, message);
  }

  function expectJson<T>(r: { body: unknown }): T {
    if (r.body === null || typeof r.body !== "object") throw new ApiError(502, "invalid_response", "The server sent an unexpected response.");
    return r.body as T;
  }

  return {
    // ---- auth ----
    async register(input: { email: string; username: string; password: string; deviceName?: string }): Promise<AuthResponse> {
      const r = await send("POST", "/api/v1/auth/register", { body: input });
      await ensureOk(r);
      return expectJson<AuthResponse>(r);
    },
    async login(input: { email: string; password: string; deviceName?: string }): Promise<AuthResponse> {
      const r = await send("POST", "/api/v1/auth/login", { body: input });
      await ensureOk(r);
      return expectJson<AuthResponse>(r);
    },
    async logout(): Promise<void> {
      const r = await send("POST", "/api/v1/auth/logout", { auth: true });
      await ensureOk(r);
    },
    async me(): Promise<MeResponse> {
      const r = await send("GET", "/api/v1/me", { auth: true });
      await ensureOk(r);
      return expectJson<MeResponse>(r);
    },
    async deleteAccount(password: string): Promise<void> {
      const r = await send("DELETE", "/api/v1/me", { auth: true, body: { password } });
      await ensureOk(r);
    },

    // ---- public content (ETag aware) ----
    /** Returns `unchanged` when the server answers 304 to the ETag the caller already holds. */
    async getContent(etag?: string): Promise<{ status: "unchanged" } | { status: "ok"; etag: string; data: ContentResponse }> {
      const r = await send("GET", "/api/v1/content", { headers: etag ? { "If-None-Match": etag } : {} });
      if (r.status === 304) return { status: "unchanged" };
      await ensureOk(r);
      const tag = r.headers.get("etag");
      if (!tag) throw new ApiError(502, "invalid_response", "The content response had no ETag.");
      return { status: "ok", etag: tag, data: expectJson<ContentResponse>(r) };
    },

    // ---- submissions ----
    async submit(input: SubmissionRequest): Promise<SubmissionResponse> {
      const r = await send("POST", "/api/v1/submissions", { auth: true, body: input });
      await ensureOk(r);
      return expectJson<SubmissionResponse>(r);
    },

    // ---- sync ----
    async pushEvents(events: SyncEventInput[]): Promise<PushResponse> {
      const r = await send("POST", "/api/v1/sync/push", { auth: true, body: { events } });
      await ensureOk(r);
      return expectJson<PushResponse>(r);
    },
    async pullSnapshot(since?: string, page?: string): Promise<PullResponse> {
      const r = await send("GET", "/api/v1/sync/pull", { auth: true, query: { since, page } });
      await ensureOk(r);
      return expectJson<PullResponse>(r);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
