import { describe, expect, it } from "vitest";
import { notFoundAs } from "@/lib/codeforces/errors";
import { ApiError } from "@/lib/api/errors";

class Fake extends Error {
  constructor(message: string, readonly kind: "not_found" | "unavailable") {
    super(message);
  }
}

describe("notFoundAs", () => {
  it("turns a Codeforces 'not found' into a 404 with the given code and message", () => {
    try {
      notFoundAs(new Fake("user.info: not found", "not_found"), "handle_not_found", "That handle was not found on Codeforces.");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ status: 404, code: "handle_not_found" });
    }
  });

  it("passes any other failure on unchanged, so it is not mistaken for a missing user", () => {
    const outage = new Fake("user.info unavailable", "unavailable");
    expect(() => notFoundAs(outage, "handle_not_found", "x")).toThrow(outage);
    const other = new Error("boom");
    expect(() => notFoundAs(other, "handle_not_found", "x")).toThrow(other);
  });
});
