import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, NetworkError, createApiClient, type FetchLike } from "./client";

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call) => Response | Promise<Response>): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init: init ?? {} };
    calls.push(call);
    return respond(call);
  };
  return { fetch, calls };
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const BASE = "https://algoryva.test";

describe("authorization header", () => {
  it("sends the bearer token on authenticated calls only", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { user: {} }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_TOKEN", fetchImpl: fetch });
    await api.me();
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer alv_TOKEN");
    await api.getContent().catch(() => undefined);
    assert.equal((calls[1]!.init.headers as Record<string, string>).Authorization, undefined, "public content must not send a token");
  });

  it("sends no header when there is no token, and the server decides", async () => {
    const { fetch, calls } = fakeFetch(() => json(401, { error: { code: "unauthorized", message: "Sign in to continue." } }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    await assert.rejects(api.me(), (e: unknown) => e instanceof ApiError && e.status === 401 && e.code === "unauthorized");
    assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, undefined);
  });
});

describe("401 handling", () => {
  it("signs out (calls onUnauthorized) when the server rejects a token that was sent", async () => {
    let signedOut = 0;
    const { fetch } = fakeFetch(() => json(401, { error: { code: "unauthorized", message: "Sign in to continue." } }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_X", fetchImpl: fetch, onUnauthorized: () => { signedOut++; } });
    await assert.rejects(api.pullSnapshot(), ApiError);
    assert.equal(signedOut, 1);
  });

  it("does not sign out for a 401 on a request that sent no token (e.g. a failed login)", async () => {
    let signedOut = 0;
    const { fetch } = fakeFetch(() => json(401, { error: { code: "invalid_credentials", message: "Invalid email or password." } }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch, onUnauthorized: () => { signedOut++; } });
    await assert.rejects(api.login({ email: "a@b.co", password: "x" }), (e: unknown) => e instanceof ApiError && e.code === "invalid_credentials");
    assert.equal(signedOut, 0);
  });

  it("does not sign out on other errors, such as a 429 with a token", async () => {
    let signedOut = 0;
    const { fetch } = fakeFetch(() => json(429, { error: { code: "rate_limited", message: "Slow down." } }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_X", fetchImpl: fetch, onUnauthorized: () => { signedOut++; } });
    await assert.rejects(api.submit({ problemId: "p", clientId: "c", output: "x" }), (e: unknown) => e instanceof ApiError && e.status === 429);
    assert.equal(signedOut, 0);
  });
});

describe("errors", () => {
  it("maps the server's error body to ApiError", async () => {
    const { fetch } = fakeFetch(() => json(409, { error: { code: "account_exists", message: "That email or username is already in use." } }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    await assert.rejects(api.register({ email: "a@b.co", username: "abc", password: "x" }), (e: unknown) => e instanceof ApiError && e.code === "account_exists" && e.message.includes("already in use"));
  });

  it("falls back to http_<status> when the body is not the standard shape (for example a proxy page)", async () => {
    const { fetch } = fakeFetch(() => new Response("<html>bad gateway</html>", { status: 502 }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    await assert.rejects(api.getContent(), (e: unknown) => e instanceof ApiError && e.code === "http_502");
  });

  it("reports an unreachable server as NetworkError (offline is not a server answer)", async () => {
    const { fetch } = fakeFetch(() => { throw new TypeError("Network request failed"); });
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_X", fetchImpl: fetch });
    await assert.rejects(api.me(), (e: unknown) => e instanceof NetworkError && e.reason === "unreachable");
  });

  it("times out a stalled request as NetworkError(timeout)", async () => {
    const { fetch } = fakeFetch((call) => new Promise<Response>((_resolve, reject) => {
      call.init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch, timeoutMs: 20 });
    await assert.rejects(api.getContent(), (e: unknown) => e instanceof NetworkError && e.reason === "timeout");
  });

  it("rejects a 2xx response that is not JSON with invalid_response", async () => {
    const { fetch } = fakeFetch(() => new Response("oops", { status: 200 }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    await assert.rejects(api.register({ email: "a@b.co", username: "abc", password: "x" }), (e: unknown) => e instanceof ApiError && e.code === "invalid_response");
  });
});

describe("content and ETags", () => {
  it("returns unchanged on 304 and sends If-None-Match", async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 304 }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    assert.deepEqual(await api.getContent('"abc123"'), { status: "unchanged" });
    assert.equal((calls[0]!.init.headers as Record<string, string>)["If-None-Match"], '"abc123"');
  });
  it("returns the ETag and parsed body on 200", async () => {
    const data = { version: "abc", topics: [], lessons: [], problems: [] };
    const { fetch } = fakeFetch(() => json(200, data, { etag: '"abc"' }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => null, fetchImpl: fetch });
    assert.deepEqual(await api.getContent(), { status: "ok", etag: '"abc"', data });
  });
  it("builds the pull query and leaves out undefined parameters", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { cursor: "c", unchanged: true }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_X", fetchImpl: fetch });
    await api.pullSnapshot("CURSOR_VALUE_22CHARS_");
    assert.equal(new URL(calls[0]!.url).search, "?since=CURSOR_VALUE_22CHARS_");
  });
});

describe("requests", () => {
  it("sends JSON bodies with the content type, and never caches", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { accepted: [], rejected: [], results: {} }));
    const api = createApiClient({ baseUrl: BASE, getToken: () => "alv_X", fetchImpl: fetch });
    await api.pushEvents([{ id: "00000000-0000-4000-8000-000000000001", at: new Date().toISOString(), type: "note.delete", payload: { id: "n" } }]);
    assert.equal(calls[0]!.init.method, "POST");
    assert.equal((calls[0]!.init.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.equal(calls[0]!.init.cache, "no-store");
    assert.equal(JSON.parse(String(calls[0]!.init.body)).events[0].type, "note.delete");
  });
});
