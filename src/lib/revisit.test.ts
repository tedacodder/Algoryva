import { describe, expect, it } from "vitest";
import { afterReminder, firstDueAt, outsideKeyOf, revisitTargetFor, startOfUtcDay } from "./revisit";

const DAY = 86_400_000;
const now = new Date("2026-10-15T08:00:00Z");

describe("the reminder ladder", () => {
  it("first reminder is due one day after the help", () => {
    expect(firstDueAt(now).getTime()).toBe(now.getTime() + DAY);
  });
  it("each reminder waits longer: 3, 7, 14, then 30 days", () => {
    expect(afterReminder(0, now)).toEqual({ step: 1, dueAt: new Date(now.getTime() + 3 * DAY) });
    expect(afterReminder(1, now)).toEqual({ step: 2, dueAt: new Date(now.getTime() + 7 * DAY) });
    expect(afterReminder(2, now)).toEqual({ step: 3, dueAt: new Date(now.getTime() + 14 * DAY) });
    expect(afterReminder(3, now)).toEqual({ step: 4, dueAt: new Date(now.getTime() + 30 * DAY) });
  });
  it("stops reminding after the fifth reminder, but keeps the revisit open", () => {
    expect(afterReminder(4, now)).toEqual({ step: 5, dueAt: null });
  });
});

describe("startOfUtcDay", () => {
  it("returns midnight UTC for the same day", () => {
    expect(startOfUtcDay(new Date("2026-10-15T23:59:59Z")).toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });
});

describe("outsideKeyOf", () => {
  it("uses the normalised link when there is one, so the same problem is queued once", () => {
    expect(outsideKeyOf("Two Sum", "https://leetcode.com/problems/two-sum")).toBe("url:https://leetcode.com/problems/two-sum");
  });
  it("falls back to a case-insensitive title when there is no link", () => {
    expect(outsideKeyOf("  Two Sum ", null)).toBe("title:two sum");
    expect(outsideKeyOf("TWO SUM", null)).toBe(outsideKeyOf("two sum", null));
  });
});

describe("revisitTargetFor", () => {
  const none = { problemId: null, problem: null, outsideTitle: null, outsideUrl: null };
  it("sends a judge-graded problem to the judge", () => {
    expect(revisitTargetFor({ ...none, problemId: "p1", problem: { kind: "INTERNAL", title: "Two Sum", externalUrl: null } }))
      .toEqual({ kind: "site", problemId: "p1" });
  });
  it("sends an external problem to self-report, using its https link", () => {
    expect(revisitTargetFor({ ...none, problemId: "p2", problem: { kind: "EXTERNAL", title: "Coin Change", externalUrl: "https://leetcode.com/problems/coin-change" } }))
      .toEqual({ kind: "outside", title: "Coin Change", url: "https://leetcode.com/problems/coin-change" });
  });
  it("drops a non-https external link rather than storing it", () => {
    expect(revisitTargetFor({ ...none, problemId: "p2", problem: { kind: "EXTERNAL", title: "X", externalUrl: "javascript:alert(1)" } }))
      .toEqual({ kind: "outside", title: "X", url: null });
  });
  it("sends a problem typed outside the site to self-report", () => {
    expect(revisitTargetFor({ ...none, outsideTitle: "Two Sum", outsideUrl: null })).toEqual({ kind: "outside", title: "Two Sum", url: null });
  });
  it("creates nothing for a mistake with no problem", () => {
    expect(revisitTargetFor(none)).toBeNull();
  });
});
