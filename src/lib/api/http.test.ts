import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_BODY_SMALL, parseWith, readJson } from "@/lib/api/http";
import { ApiError, errorResponse, handle, json } from "@/lib/api/errors";

const post = (body: BodyInit | null, headers: Record<string, string> = { "content-type": "application/json" }) => new Request("http://x/", { method: "POST", body, headers });

describe("readJson", () => {
  it("parses JSON (charset parameter allowed)", async () => {
    expect(await readJson(post('{"a":1}'), 100)).toEqual({ a: 1 });
    expect(await readJson(post('{"a":1}', { "content-type": "application/json; charset=utf-8" }), 100)).toEqual({ a: 1 });
  });
  it("415 for another content type or none", async () => {
    for (const h of [{ "content-type": "text/plain" }, { "content-type": "application/jsonx" }, {} as Record<string, string>]) {
      await expect(readJson(post("{}", h), 100)).rejects.toMatchObject({ status: 415, code: "unsupported_media_type" });
    }
  });
  it("413 when the declared length or the real byte count is over the limit", async () => {
    await expect(readJson(post("x".repeat(101), { "content-type": "application/json", "content-length": "101" }), 100)).rejects.toMatchObject({ status: 413 });
    const lying = post(JSON.stringify({ a: "x".repeat(300) }), { "content-type": "application/json", "content-length": "5" });
    await expect(readJson(lying, 100)).rejects.toMatchObject({ status: 413 });
  });
  it("counts bytes, not characters", async () => {
    await expect(readJson(post(JSON.stringify({ a: "é".repeat(60) })), 100)).rejects.toMatchObject({ status: 413 });
  });
  it("400 for an empty body, invalid JSON and invalid UTF-8", async () => {
    await expect(readJson(post(""), 100)).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post("{nope"), 100)).rejects.toMatchObject({ status: 400, code: "invalid_request" });
    await expect(readJson(post(new Uint8Array([0x7b, 0xff, 0x7d])), 100)).rejects.toMatchObject({ status: 400 });
  });
  it("exposes the small-body limit", () => { expect(MAX_BODY_SMALL).toBe(8192); });
});

describe("parseWith", () => {
  const schema = z.object({ email: z.string().email(), n: z.number() }).strict();
  it("returns the data, or a 400 that names the field and never the value", () => {
    expect(parseWith(schema, { email: "a@b.co", n: 1 })).toEqual({ email: "a@b.co", n: 1 });
    try { parseWith(schema, { email: "secret-password-value", n: 1 }); throw new Error("should fail"); } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
      expect((e as ApiError).message).toContain("email");
      expect((e as ApiError).message).not.toContain("secret-password-value");
    }
    expect(() => parseWith(schema, { email: "a@b.co", n: 1, extra: true })).toThrow(ApiError);
  });
});

describe("errors", () => {
  it("one shape, no-store, and unexpected errors never leak their message", async () => {
    const r = errorResponse(new ApiError(429, "rate_limited", "Slow down.", { "Retry-After": "60" }));
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: { code: "rate_limited", message: "Slow down." } });
    const x = errorResponse(new Error("postgres://user:pw@host/db"));
    expect(x.status).toBe(500);
    expect(JSON.stringify(await x.json())).not.toContain("postgres");
  });
  it("handle wraps thrown errors, and json() is no-store", async () => {
    const h = handle(async () => { throw new ApiError(404, "not_found", "nope"); });
    expect((await h(new Request("http://x"))).status).toBe(404);
    expect(json({ ok: true }).headers.get("cache-control")).toBe("no-store");
  });
});
