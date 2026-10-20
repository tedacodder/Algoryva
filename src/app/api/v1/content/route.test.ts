import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ problemFindMany: vi.fn(), lessonFindMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { problem: { findMany: m.problemFindMany }, lesson: { findMany: m.lessonFindMany } } }));
vi.mock("@/lib/cache", () => ({ cached: async (_n: string, _t: number, load: () => Promise<unknown>) => load() }));

import { GET } from "@/app/api/v1/content/route";

const row = { id: "p1", slug: "s", title: "T", kind: "INTERNAL", difficulty: "EASY", source: null, externalUrl: null, statement: "x", inputSpec: null, outputSpec: null, constraints: null, timeLimitMs: null, memoryLimitMb: null, position: 0, topics: [], testCases: [{ input: "i", expected: "o", explanation: null, isSample: true }, { input: "HIDDEN-IN", expected: "HIDDEN-OUT", explanation: null, isSample: false }], _count: { testCases: 2 } };
const get = (headers: Record<string, string> = {}) => GET(new Request("http://localhost/api/v1/content", { headers }));

beforeEach(() => { m.problemFindMany.mockReset().mockResolvedValue([row]); m.lessonFindMany.mockReset().mockResolvedValue([]); });

describe("GET /api/v1/content", () => {
  it("returns public JSON with an ETag and shared-cache headers, and never sets a cookie", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(r.headers.get("etag")).toMatch(/^"[0-9a-f]{16}"$/);
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    expect(r.headers.get("set-cookie")).toBeNull();
    const body = await r.json();
    expect(Object.keys(body)).toEqual(["version", "topics", "lessons", "problems"]);
    expect(JSON.stringify(body)).not.toContain("HIDDEN");
    expect(body.version).toBe(r.headers.get("etag")!.replaceAll('"', ""));
  });

  it("answers 304 with no body when If-None-Match matches, and 200 when it does not", async () => {
    const etag = (await get()).headers.get("etag")!;
    const hit = await get({ "if-none-match": etag });
    expect(hit.status).toBe(304);
    expect(await hit.text()).toBe("");
    expect(hit.headers.get("etag")).toBe(etag);
    expect((await get({ "if-none-match": '"other"' })).status).toBe(200);
  });

  it("is identical for anonymous, bearer and cookie callers (same bytes, same ETag)", async () => {
    const anon = await get();
    const bearer = await get({ authorization: "Bearer alv_" + "a".repeat(43) });
    const cookie = await get({ cookie: "session=abc123", authorization: "Bearer junk" });
    const texts = await Promise.all([anon.text(), bearer.text(), cookie.text()]);
    expect(texts[1]).toBe(texts[0]);
    expect(texts[2]).toBe(texts[0]);
    expect(bearer.headers.get("etag")).toBe(anon.headers.get("etag"));
    expect(cookie.headers.get("etag")).toBe(anon.headers.get("etag"));
    expect(bearer.headers.get("set-cookie")).toBeNull();
  });

  it("fails closed with a generic 500 and no details when the database fails or the serializer rejects", async () => {
    m.problemFindMany.mockRejectedValue(new Error("connection string postgres://user:pw@host leaked"));
    const r = await get();
    expect(r.status).toBe(500);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await r.json())).not.toMatch(/postgres|leaked/);
  });
});
