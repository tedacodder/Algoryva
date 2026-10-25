import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { backoffDelayMs, BACKOFF_CAP_MS } from "../sync/backoff";
import { nextReviewDate, passMark, unlockState, outsideKeyOf, firstDueAt } from "./schedule";
import { checkMistake } from "./mistake";

const day = 86_400_000;
const from = new Date("2026-10-20T00:00:00Z");

describe("review schedule (matches the website's ladder)", () => {
  it("steps 0..4 are 1, 3, 7, 14, 30 days, and the last rung repeats", () => {
    const days = [0, 1, 2, 3, 4, 9].map((s) => (nextReviewDate(from, s).getTime() - from.getTime()) / day);
    assert.deepEqual(days, [1, 3, 7, 14, 30, 30]);
  });
  it("first due is one day after the first completion", () => assert.equal(firstDueAt(from).getTime() - from.getTime(), day));
});

describe("quiz pass mark", () => {
  it("is 80% rounded up", () => {
    assert.equal(passMark(5), 4);
    assert.equal(passMark(6), 5);
    assert.equal(passMark(10), 8);
  });
});

describe("topic unlock", () => {
  it("is unlocked only when every prerequisite is completed", () => {
    assert.deepEqual(unlockState([], new Set()), { unlocked: true, missing: [] });
    assert.deepEqual(unlockState(["a", "b"], new Set(["a"])), { unlocked: false, missing: ["b"] });
    assert.equal(unlockState(["a"], new Set(["a"])).unlocked, true);
  });
});

describe("outside problem identity", () => {
  it("uses the link when there is one, otherwise the trimmed, lower-cased title", () => {
    assert.equal(outsideKeyOf("Two Sum", "https://x.test/a"), "url:https://x.test/a");
    assert.equal(outsideKeyOf("  Two Sum ", null), "title:two sum");
  });
});

describe("mistake validation (website rules)", () => {
  const base = { type: "CONCEPTUAL", misunderstood: "I mixed up the base", correctIdea: "Check empty first", recognizeNextTime: "recursion" };
  it("accepts a valid mistake", () => assert.deepEqual(checkMistake(base), { ok: true }));
  it("rejects an unknown type, short text, both a site and an outside problem, and a non-https link", () => {
    assert.equal(checkMistake({ ...base, type: "NOPE" }).ok, false);
    assert.equal(checkMistake({ ...base, misunderstood: "x" }).ok, false);
    assert.equal(checkMistake({ ...base, problemId: "p1", outsideTitle: "Other" }).ok, false);
    assert.equal(checkMistake({ ...base, outsideTitle: "Two Sum", outsideUrl: "http://insecure.test" }).ok, false);
    assert.equal(checkMistake({ ...base, outsideUrl: "https://x.test" }).ok, false, "a link needs a title");
  });
});

describe("backoff", () => {
  const mid = () => 0.5; // jitter factor 1.0
  it("doubles from 2 seconds and is exact at the midpoint of the jitter", () => {
    assert.equal(backoffDelayMs(1, mid), 2_000);
    assert.equal(backoffDelayMs(2, mid), 4_000);
    assert.equal(backoffDelayMs(3, mid), 8_000);
  });
  it("jitter keeps every delay between half and one and a half times the step", () => {
    assert.equal(backoffDelayMs(3, () => 0), 4_000);
    assert.ok(backoffDelayMs(3, () => 0.999) < 12_000);
  });
  it("never exceeds the 10 minute cap, however many failures", () => {
    for (let f = 1; f < 40; f++) assert.ok(backoffDelayMs(f, () => 0.999) <= BACKOFF_CAP_MS);
    assert.equal(backoffDelayMs(40, mid), BACKOFF_CAP_MS);
  });
});
