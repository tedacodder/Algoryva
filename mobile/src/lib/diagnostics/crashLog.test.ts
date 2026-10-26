import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addReport, formatForSharing, makeReport, MAX_REPORTS, redact, type CrashReport } from "./crashLog";

describe("redaction", () => {
  it("removes email addresses, tokens and passwords", () => {
    const out = redact("failed for ali@example.com with Bearer abc.def.ghi and password=hunter2");
    assert.ok(!out.includes("ali@example.com"));
    assert.ok(!out.includes("abc.def.ghi"));
    assert.ok(!out.includes("hunter2"));
    assert.match(out, /\[email\]/);
  });
  it("removes long identifiers and long numbers", () => {
    const out = redact("id 0123456789abcdef0123456789abcdef and phone 0912345678");
    assert.ok(!out.includes("0123456789abcdef0123456789abcdef"));
    assert.ok(!out.includes("0912345678"));
  });
  it("keeps ordinary messages readable", () => {
    assert.equal(redact("TypeError: cannot read property 'x' of undefined"), "TypeError: cannot read property 'x' of undefined");
  });
  it("limits the length of stored text", () => {
    assert.ok(redact("x".repeat(10000)).length <= 2000);
  });
});

describe("reports", () => {
  it("builds a report from an error, redacting its message", () => {
    const r = makeReport(new Error("login failed for a@b.co"), true, new Date("2026-10-27T10:00:00Z"));
    assert.equal(r.fatal, true);
    assert.equal(r.at, "2026-10-27T10:00:00.000Z");
    assert.ok(!r.message.includes("a@b.co"));
  });
  it("accepts a non-error value", () => {
    const r = makeReport("plain text", false, new Date());
    assert.equal(r.message, "plain text");
  });
  it("keeps only the newest reports", () => {
    let list: CrashReport[] = [];
    for (let i = 0; i < MAX_REPORTS + 5; i++) {
      list = addReport(list, makeReport(new Error(`e${i}`), false, new Date()));
    }
    assert.equal(list.length, MAX_REPORTS);
    assert.equal(list[list.length - 1]!.message, `e${MAX_REPORTS + 4}`);
  });
  it("says so when there is nothing to share", () => {
    assert.equal(formatForSharing([]), "No crash reports on this phone.");
  });
});
