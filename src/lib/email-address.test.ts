import { describe, expect, it } from "vitest";
import { brevoBody, cleanEnvValue, maskEmail, parseFrom } from "./email-address";

describe("parseFrom", () => {
  it("splits a display name and address", () => {
    expect(parseFrom("Algoryva <no-reply@example.com>")).toEqual({ name: "Algoryva", email: "no-reply@example.com" });
  });
  it("accepts a quoted name and extra spaces", () => {
    expect(parseFrom('  "Algoryva Team"   <team@example.com> ')).toEqual({ name: "Algoryva Team", email: "team@example.com" });
  });
  it("accepts a bare address with no name", () => {
    expect(parseFrom("no-reply@example.com")).toEqual({ email: "no-reply@example.com" });
  });
});

describe("brevoBody", () => {
  it("builds the sender, recipient and both bodies Brevo needs", () => {
    expect(brevoBody({ from: "Algoryva <no-reply@example.com>", to: "student@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" })).toEqual({
      sender: { name: "Algoryva", email: "no-reply@example.com" },
      to: [{ email: "student@example.com" }],
      subject: "Hi",
      textContent: "plain",
      htmlContent: "<p>html</p>",
    });
  });
});

describe("maskEmail", () => {
  it("keeps the first and last character of the name and the whole domain", () => {
    expect(maskEmail("tedacodder@gmail.com")).toBe("t" + "*".repeat(8) + "r@gmail.com");
  });
  it("masks very short names without leaking them", () => {
    expect(maskEmail("ab@x.io")).toBe("a*@x.io");
  });
  it("does not echo input that is not an address", () => {
    expect(maskEmail("nope")).toBe("your email address");
  });
});

describe("cleanEnvValue", () => {
  it("removes surrounding quotes, spaces and line breaks that paste can add", () => {
    expect(cleanEnvValue('"xkeysib-abc"')).toBe("xkeysib-abc");
    expect(cleanEnvValue("  xkeysib-abc\n")).toBe("xkeysib-abc");
    expect(cleanEnvValue("'xkeysib-abc'\r\n")).toBe("xkeysib-abc");
  });
  it("keeps a value that is already clean, and quotes that are part of it", () => {
    expect(cleanEnvValue("xkeysib-abc")).toBe("xkeysib-abc");
    expect(cleanEnvValue('Algoryva <a@b.co>')).toBe("Algoryva <a@b.co>");
  });
  it("treats empty or missing values as not set", () => {
    expect(cleanEnvValue(undefined)).toBeUndefined();
    expect(cleanEnvValue("   ")).toBeUndefined();
    expect(cleanEnvValue('""')).toBeUndefined();
  });
});
