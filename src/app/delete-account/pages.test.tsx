import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const m = vi.hoisted(() => ({ user: null as null | { id: string }, contact: null as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => m.user, requireUser: async () => m.user, destroySession: async () => {} }));
vi.mock("@/lib/privacy", () => ({ get PRIVACY_CONTACT_EMAIL() { return m.contact; } }));
vi.mock("@/app/delete-account/actions", () => ({ deleteMyAccount: async () => undefined }));

import DeleteAccountPage from "@/app/delete-account/page";
import PrivacyPage from "@/app/privacy/page";

const html = async (el: Promise<React.ReactElement> | React.ReactElement) => renderToStaticMarkup(await el);
const del = (q: { done?: string } = {}) => DeleteAccountPage({ searchParams: Promise.resolve(q) });
beforeEach(() => { m.user = null; m.contact = null; });

describe("the privacy contact address", () => {
  it("is not invented: the shipped value in src/lib/privacy.ts is null", async () => {
    const real = await vi.importActual<typeof import("@/lib/privacy")>("@/lib/privacy"); // the real module, not the mock
    expect(real.PRIVACY_CONTACT_EMAIL).toBeNull();
  });
  it("both pages say plainly that it is pending, and publish no address or mailto link", async () => {
    for (const out of [await html(del()), await html(<PrivacyPage />)]) {
      expect(out).toMatch(/not been published yet/);
      expect(out).not.toMatch(/mailto:/);
      expect(out).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
  it("shows a real address (as a mailto link) only when one is configured", async () => {
    m.contact = "privacy@example.test";
    for (const out of [await html(del()), await html(<PrivacyPage />)]) expect(out).toContain('href="mailto:privacy@example.test"');
    expect(await html(<PrivacyPage />)).not.toMatch(/not been published yet/);
  });
});

describe("/delete-account", () => {
  it("signed out: explains and links to sign in, with no deletion form", async () => {
    const out = await html(del());
    expect(out).toContain("Sign in to delete your account");
    expect(out).toContain('href="/login"');
    expect(out).not.toContain('type="password"');
  });
  it("signed in: shows a real deletion form (password and confirmation), not just a link", async () => {
    m.user = { id: "u1" };
    const out = await html(del());
    expect(out).toContain('type="password"');
    expect(out).toContain('name="confirm"');
    expect(out).toContain("Delete my account permanently");
  });
  it("after deletion: confirms, and shows no form even if a stale session exists", async () => {
    m.user = { id: "u1" };
    const out = await html(del({ done: "1" }));
    expect(out).toContain("Your account was deleted");
    expect(out).not.toContain('type="password"');
  });
  it("states the retention limits plainly and does not claim instant erasure everywhere", async () => {
    const out = await html(del());
    expect(out).toMatch(/Backups/);
    expect(out).toMatch(/logs/);
    expect(out).not.toMatch(/instantly erased|completely erased from everywhere/i);
  });
});

describe("/privacy", () => {
  it("is marked as a draft that has not been reviewed, and links to the deletion page", async () => {
    const out = await html(<PrivacyPage />);
    expect(out).toContain("Draft, not yet reviewed");
    expect(out).toContain('href="/delete-account"');
  });
});
