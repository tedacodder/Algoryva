import { describe, expect, it } from "vitest";
import { passwordChangedEmail, passwordResetEmail, renderEmail, revisitDigestEmail, verificationEmail } from "./email-templates";

const BASE = "https://algoryva.vercel.app";

describe("verificationEmail", () => {
  const m = verificationEmail(BASE, "abc123");
  it("has a clear subject and the confirmation link in both versions", () => {
    expect(m.subject).toBe("Confirm your Algoryva email address");
    expect(m.text).toContain(`${BASE}/verify-email?token=abc123`);
    expect(m.html).toContain(`href="${BASE}/verify-email?token=abc123"`);
  });
  it("states how long the link works and that it is single-use", () => {
    expect(m.text).toContain("24 hours");
    expect(m.text).toContain("once");
  });
  it("keeps the plain-text version free of markup", () => {
    expect(m.text).not.toMatch(/<[a-z]/i);
  });
});

describe("passwordResetEmail", () => {
  it("states the one-hour window and points to the reset page", () => {
    const m = passwordResetEmail(BASE, "tok");
    expect(m.text).toContain(`${BASE}/reset-password?token=tok`);
    expect(m.text).toContain("one hour");
  });
});

describe("passwordChangedEmail", () => {
  it("is a security notice that tells the user what to do if they did not make the change", () => {
    const m = passwordChangedEmail(BASE);
    expect(m.subject).toBe("Your Algoryva password was changed");
    expect(m.text).toContain(`${BASE}/forgot-password`);
    expect(m.text).toContain("If it was not");
  });
});

describe("renderEmail", () => {
  it("escapes user-controlled text so it cannot inject markup", () => {
    const m = renderEmail({ base: "http://localhost:3000", subject: "s", preheader: "p", heading: "<script>alert(1)</script>", paragraphs: ["a & b"], footnote: "f" });
    expect(m.html).not.toContain("<script>alert(1)</script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).toContain("a &amp; b");
  });
  it("uses the wordmark, not an image, when the site is not https", () => {
    const m = renderEmail({ base: "http://localhost:3000", subject: "s", preheader: "p", heading: "h", paragraphs: [], footnote: "f" });
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("Algoryva");
  });
  it("uses the logo image when the site is https", () => {
    const m = renderEmail({ base: BASE, subject: "s", preheader: "p", heading: "h", paragraphs: [], footnote: "f" });
    expect(m.html).toContain(`${BASE}/brand/algoryva-lockup-email.png`);
  });
});

describe("revisitDigestEmail", () => {
  it("names the count, lists the problems, and links to the revisits page", () => {
    const m = revisitDigestEmail(BASE, ["Two Sum", "Binary Search"], 0);
    expect(m.subject).toBe("2 problems to solve again without help");
    expect(m.text).toContain("• Two Sum");
    expect(m.text).toContain(`${BASE}/revisits`);
  });
  it("uses the singular and mentions problems that are not listed", () => {
    expect(revisitDigestEmail(BASE, ["Two Sum"], 0).subject).toBe("1 problem to solve again without help");
    expect(revisitDigestEmail(BASE, ["P1"], 4).text).toContain("…and 4 more");
  });
  it("escapes problem titles", () => {
    const m = revisitDigestEmail(BASE, ["<img src=x>"], 0);
    expect(m.html).not.toContain("<img src=x>");
    expect(m.html).toContain("&lt;img");
  });
});
