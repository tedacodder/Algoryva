import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, DEFAULT_API_BASE_URL, isLocalOrLan, resolveApiBaseUrl } from "./config";

describe("resolveApiBaseUrl", () => {
  it("uses the default site when nothing is set", () => {
    assert.equal(resolveApiBaseUrl(undefined, false), DEFAULT_API_BASE_URL);
    assert.equal(resolveApiBaseUrl("   ", false), DEFAULT_API_BASE_URL);
  });
  it("accepts https and strips trailing slashes", () => {
    assert.equal(resolveApiBaseUrl("https://algoryva.vercel.app//", false), "https://algoryva.vercel.app");
  });
  it("refuses plain http in production", () => {
    assert.throws(() => resolveApiBaseUrl("http://192.168.1.5:3000", false), ConfigError);
  });
  it("allows http only in development and only for a local or LAN address", () => {
    assert.equal(resolveApiBaseUrl("http://192.168.1.5:3000", true), "http://192.168.1.5:3000");
    assert.equal(resolveApiBaseUrl("http://10.0.2.2:3000", true), "http://10.0.2.2:3000");
    assert.throws(() => resolveApiBaseUrl("http://example.com", true), ConfigError);
  });
  it("rejects credentials, query strings, and non-URLs", () => {
    assert.throws(() => resolveApiBaseUrl("https://user:pw@algoryva.vercel.app", false), ConfigError);
    assert.throws(() => resolveApiBaseUrl("https://algoryva.vercel.app?x=1", false), ConfigError);
    assert.throws(() => resolveApiBaseUrl("not a url", false), ConfigError);
    assert.throws(() => resolveApiBaseUrl("ftp://algoryva.vercel.app", false), ConfigError);
  });
  it("never echoes the value in its error message", () => {
    assert.throws(
      () => resolveApiBaseUrl("http://public.example", false),
      (e: unknown) => e instanceof ConfigError && !e.message.includes("public.example"),
    );
  });
});

describe("isLocalOrLan", () => {
  it("recognises loopback, emulator host and private ranges", () => {
    for (const h of ["localhost", "127.0.0.1", "10.0.2.2", "10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.0.10"]) assert.equal(isLocalOrLan(h), true, h);
  });
  it("rejects public addresses and near-miss ranges", () => {
    for (const h of ["8.8.8.8", "172.32.0.1", "172.15.0.1", "192.169.0.1", "algoryva.vercel.app"]) assert.equal(isLocalOrLan(h), false, h);
  });
});
