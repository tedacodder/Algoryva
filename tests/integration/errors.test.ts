import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { resetDb, realDb as db } from "./db";
import { ratingFor } from "@/lib/bot/contest";
import { ApiError } from "@/lib/api/errors";

const NOW = new Date("2026-11-10T12:00:00Z");

/** A Codeforces stand-in: unknown handles are "not found", and "down" simulates an outage. */
function codeforces(mode: { down?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const method = url.pathname.split("/").pop();
      if (mode.down) return Response.json({ status: "FAILED", comment: "Internal error" }, { status: 500 });
      if (method === "user.info") {
        const handle = url.searchParams.get("handles") ?? "";
        if (handle.toLowerCase() === "nobody") return Response.json({ status: "FAILED", comment: `handles: User with handle ${handle} not found` }, { status: 400 });
        return Response.json({ status: "OK", result: [{ handle, rating: 1500, maxRating: 1600, rank: "specialist", maxRank: "expert" }] });
      }
      if (method === "user.rating") return Response.json({ status: "OK", result: [] });
      return Response.json({ status: "FAILED", comment: "unexpected" }, { status: 400 });
    }),
  );
}

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", "errors-secret-0123456789abcdef-wxyz");
  await resetDb();
  await db.cfCache.deleteMany();
  vi.unstubAllGlobals();
});

describe("rating errors are clear", () => {
  it("a handle that does not exist is a 404 that says so", async () => {
    codeforces({});
    await expect(ratingFor("nobody", NOW)).rejects.toMatchObject({ status: 404, code: "handle_not_found" });
  });

  it("an outage is a 503 and does not blame the handle", async () => {
    codeforces({ down: true });
    const error = await ratingFor("tourist", NOW).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "codeforces_unavailable" });
  });

  it("a real handle returns its rating", async () => {
    codeforces({});
    const result = await ratingFor("tourist", NOW);
    expect(result).toMatchObject({ handle: "tourist", rating: 1500, maxRating: 1600, contests: 0 });
  });
});
