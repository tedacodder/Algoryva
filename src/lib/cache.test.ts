import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), incr: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = m.get;
    set = m.set;
    incr = m.incr;
  },
}));

async function loadCache() {
  vi.resetModules();
  return import("./cache");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
});
afterEach(() => vi.unstubAllEnvs());

describe("cached (with Redis configured)", () => {
  it("loads from the database on a miss, then stores the result with a TTL", async () => {
    m.get.mockResolvedValueOnce("0").mockResolvedValueOnce(null);
    const { cached } = await loadCache();
    const load = vi.fn(async () => ({ title: "Two Sum" }));
    expect(await cached("problem:two-sum", 300, load)).toEqual({ title: "Two Sum" });
    expect(load).toHaveBeenCalledOnce();
    expect(m.set).toHaveBeenCalledWith("problem:two-sum:v0", { title: "Two Sum" }, { ex: 300 });
  });

  it("returns the stored value on a hit without touching the database", async () => {
    m.get.mockResolvedValueOnce("0").mockResolvedValueOnce({ title: "Cached" });
    const { cached } = await loadCache();
    const load = vi.fn(async () => ({ title: "Fresh" }));
    expect(await cached("problem:two-sum", 300, load)).toEqual({ title: "Cached" });
    expect(load).not.toHaveBeenCalled();
  });

  it("uses a new key after an invalidation, so admin edits show at once", async () => {
    m.get.mockResolvedValueOnce("3").mockResolvedValueOnce(null);
    const { cached } = await loadCache();
    await cached("practice:arrays", 300, async () => []);
    expect(m.set).toHaveBeenCalledWith("practice:arrays:v3", [], { ex: 300 });
  });

  it("increments the version when content is invalidated", async () => {
    const { invalidateContent } = await loadCache();
    await invalidateContent();
    expect(m.incr).toHaveBeenCalledWith("content:version");
  });

  it("falls back to the database when Redis fails, and never throws", async () => {
    m.get.mockRejectedValueOnce(new Error("connection reset"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { cached } = await loadCache();
    expect(await cached("problem:two-sum", 300, async () => "from db")).toBe("from db");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("cached (without Redis configured)", () => {
  it("is off: every read goes to the database, and nothing is written", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { cached, invalidateContent } = await loadCache();
    const load = vi.fn(async () => 1);
    await cached("x", 300, load);
    await cached("x", 300, load);
    await invalidateContent();
    expect(load).toHaveBeenCalledTimes(2);
    expect(m.get).not.toHaveBeenCalled();
    expect(m.set).not.toHaveBeenCalled();
    expect(m.incr).not.toHaveBeenCalled();
  });
});
