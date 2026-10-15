import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

const m = vi.hoisted(() => ({
  consumeToken: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  requireUser: vi.fn(),
  isBlocked: vi.fn(),
  record: vi.fn(),
  verifyPassword: vi.fn(),
  sendVerificationEmail: vi.fn(),
  sendEmailChangeVerification: vi.fn(),
  sendEmailChangeNotice: vi.fn(),
  sendPasswordChangedEmail: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: m.userFindUnique, update: m.userUpdate },
    session: { deleteMany: vi.fn() },
    $transaction: m.transaction,
  },
}));
vi.mock("@/lib/auth/tokens", () => ({ consumeToken: m.consumeToken, createToken: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "new-hash"), verifyPassword: m.verifyPassword }));
vi.mock("@/lib/auth/account-mail", () => ({
  sendVerificationEmail: m.sendVerificationEmail,
  sendPasswordResetEmail: vi.fn(),
  sendPasswordChangedEmail: m.sendPasswordChangedEmail,
  sendEmailChangeVerification: m.sendEmailChangeVerification,
  sendEmailChangeNotice: m.sendEmailChangeNotice,
}));
vi.mock("@/lib/rate-limit", () => ({
  HOUR: 3_600_000,
  anyBlocked: vi.fn(async () => false),
  recordAll: vi.fn(),
  trustedClientIp: vi.fn(async () => null),
  isBlocked: m.isBlocked,
  record: m.record,
}));
vi.mock("@/app/actions", () => ({ login: vi.fn() }));

import { confirmEmail, resendVerification, resetPassword } from "./auth-actions";
import { cancelEmailChange, requestEmailChange } from "./account-actions";
import VerifyEmailPage from "./verify-email/page";
import LoginPage from "./login/page";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.resetAllMocks();
  m.userUpdate.mockResolvedValue(undefined);
  m.transaction.mockResolvedValue([]);
  m.requireUser.mockResolvedValue({ id: "user-1" });
  m.isBlocked.mockResolvedValue(false);
});

describe("the verification link", () => {
  it("opening the link does not use up the token, so email scanners cannot confirm the account", async () => {
    renderToString(await VerifyEmailPage({ searchParams: Promise.resolve({ token: "abc123" }) }));
    expect(m.consumeToken).not.toHaveBeenCalled();
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("shows a confirm button with the token in a hidden field", async () => {
    const html = renderToString(await VerifyEmailPage({ searchParams: Promise.resolve({ token: "abc123" }) }));
    expect(html).toContain("Confirm email address");
    expect(html).toContain('value="abc123"');
  });
});

describe("confirmEmail (sign-up verification)", () => {
  it("rejects a used or expired token and explains what to do", async () => {
    m.consumeToken.mockResolvedValue(null);
    const result = await confirmEmail(undefined, form({ token: "old", kind: "verify" }));
    expect(result?.error).toContain("invalid or has expired");
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("marks the address verified and sends the user to the confirmed page", async () => {
    m.consumeToken.mockResolvedValue("user-1");
    await confirmEmail(undefined, form({ token: "fresh", kind: "verify" }));
    expect(m.consumeToken).toHaveBeenCalledWith("fresh", "verify");
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { emailVerifiedAt: expect.any(Date) } });
    expect(m.redirect).toHaveBeenCalledWith("/verify-email?done=1");
  });
});

describe("confirmEmail (email change)", () => {
  it("switches the sign-in address to the pending one and clears the pending field", async () => {
    m.consumeToken.mockResolvedValue("user-1");
    m.userFindUnique.mockResolvedValue({ pendingEmail: "new@example.com" });
    await confirmEmail(undefined, form({ token: "t", kind: "change" }));
    expect(m.consumeToken).toHaveBeenCalledWith("t", "change-email");
    expect(m.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: "new@example.com", pendingEmail: null, emailVerifiedAt: expect.any(Date) },
    });
    expect(m.redirect).toHaveBeenCalledWith("/verify-email?done=change");
  });

  it("refuses when there is no pending change any more (for example, it was cancelled)", async () => {
    m.consumeToken.mockResolvedValue("user-1");
    m.userFindUnique.mockResolvedValue({ pendingEmail: null });
    const result = await confirmEmail(undefined, form({ token: "t", kind: "change" }));
    expect(result?.error).toContain("invalid or has expired");
    expect(m.userUpdate).not.toHaveBeenCalled();
  });

  it("explains a clash with an address another account already uses", async () => {
    m.consumeToken.mockResolvedValue("user-1");
    m.userFindUnique.mockResolvedValue({ pendingEmail: "taken@example.com" });
    m.userUpdate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const result = await confirmEmail(undefined, form({ token: "t", kind: "change" }));
    expect(result?.error).toContain("already in use");
  });
});

describe("requestEmailChange", () => {
  const current = { email: "old@example.com", passwordHash: "h" };

  it("requires the correct current password and changes nothing without it", async () => {
    m.userFindUnique.mockResolvedValueOnce(current);
    m.verifyPassword.mockResolvedValue(false);
    const result = await requestEmailChange(undefined, form({ email: "new@example.com", password: "wrong" }));
    expect(result?.error).toBe("Your password is incorrect.");
    expect(m.userUpdate).not.toHaveBeenCalled();
    expect(m.sendEmailChangeVerification).not.toHaveBeenCalled();
  });

  it("rejects an invalid or unchanged address before checking anything else", async () => {
    expect((await requestEmailChange(undefined, form({ email: "not-an-email", password: "x" })))?.error).toContain("valid email");
    m.userFindUnique.mockResolvedValueOnce(current);
    expect((await requestEmailChange(undefined, form({ email: "OLD@example.com", password: "x" })))?.error).toContain("already your email");
  });

  it("stores the pending address, emails the new one, and tells the old one", async () => {
    m.userFindUnique
      .mockResolvedValueOnce(current)   // the account row
      .mockResolvedValueOnce(null);     // the new address is free
    m.verifyPassword.mockResolvedValue(true);
    m.sendEmailChangeVerification.mockResolvedValue(true);
    const result = await requestEmailChange(undefined, form({ email: "new@example.com", password: "right" }));
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { pendingEmail: "new@example.com" } });
    expect(m.sendEmailChangeVerification).toHaveBeenCalledWith("user-1", "new@example.com");
    expect(m.sendEmailChangeNotice).toHaveBeenCalledWith("old@example.com", "new@example.com");
    expect(result?.message).toContain("We sent a confirmation link to");
    expect(result?.message).toContain("@example.com");
    expect(result?.message).not.toContain("new@example.com");
  });

  it("does not claim the link was sent when the send failed", async () => {
    m.userFindUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(null);
    m.verifyPassword.mockResolvedValue(true);
    m.sendEmailChangeVerification.mockResolvedValue(false);
    const result = await requestEmailChange(undefined, form({ email: "new@example.com", password: "right" }));
    expect(result?.error).toContain("could not send");
    expect(m.sendEmailChangeNotice).not.toHaveBeenCalled();
  });
});

describe("cancelEmailChange", () => {
  it("drops the pending address", async () => {
    await cancelEmailChange();
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { pendingEmail: null } });
  });
});

describe("resendVerification", () => {
  it("says so when the address is already confirmed", async () => {
    m.userFindUnique.mockResolvedValue({ email: "a@b.co", emailVerifiedAt: new Date() });
    expect(await resendVerification()).toEqual({ message: "Your email address is already confirmed." });
    expect(m.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("reports a successful send", async () => {
    m.userFindUnique.mockResolvedValue({ email: "a@b.co", emailVerifiedAt: null });
    m.sendVerificationEmail.mockResolvedValue(true);
    const result = await resendVerification();
    expect(result?.message).toContain("Check your inbox");
    expect(result?.error).toBeUndefined();
  });

  it("reports a failed send instead of claiming success", async () => {
    m.userFindUnique.mockResolvedValue({ email: "a@b.co", emailVerifiedAt: null });
    m.sendVerificationEmail.mockResolvedValue(false);
    const result = await resendVerification();
    expect(result?.error).toContain("could not send");
    expect(result?.message).toBeUndefined();
  });

  it("explains the limit when too many emails were requested", async () => {
    m.userFindUnique.mockResolvedValue({ email: "a@b.co", emailVerifiedAt: null });
    m.isBlocked.mockResolvedValue(true);
    const result = await resendVerification();
    expect(result?.error).toContain("several emails");
    expect(m.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("sends the user to the login page with the password-updated notice, and warns the owner", async () => {
    m.consumeToken.mockResolvedValue("user-1");
    m.transaction.mockResolvedValue([]);
    m.userFindUnique.mockResolvedValue({ email: "owner@example.com" });
    await resetPassword(undefined, form({ token: "tok", password: "a-long-new-password" }));
    expect(m.transaction).toHaveBeenCalled();
    expect(m.sendPasswordChangedEmail).toHaveBeenCalledWith("owner@example.com");
    expect(m.redirect).toHaveBeenCalledWith("/login?reset=1");
  });
});

describe("login page", () => {
  it("says the password was updated after a reset, and gives the normal line otherwise", async () => {
    const after = renderToString(await LoginPage({ searchParams: Promise.resolve({ reset: "1" }) }));
    expect(after).toContain("Your password is updated");
    const normal = renderToString(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(normal).toContain("Pick up where you left off.");
  });
});
