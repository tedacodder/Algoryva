import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ runRevisitDigests: vi.fn() }));
vi.mock("@/lib/revisit-store", () => ({ runRevisitDigests: m.runRevisitDigests }));

import { GET } from "./route";

const call = (auth?: string) => GET(new Request("https://algoryva.vercel.app/api/cron/revisits", { headers: auth ? { authorization: auth } : {} }));

beforeEach(() => {
  vi.resetAllMocks();
  m.runRevisitDigests.mockResolvedValue({ users: 0, sent: 0, failed: 0 });
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/revisits", () => {
  it("refuses every request when CRON_SECRET is not set", async () => {
    expect((await call("Bearer anything")).status).toBe(401);
    expect(m.runRevisitDigests).not.toHaveBeenCalled();
  });
  it("refuses a request without the right bearer token", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(m.runRevisitDigests).not.toHaveBeenCalled();
  });
  it("runs the digest for a request from Vercel Cron", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(m.runRevisitDigests).toHaveBeenCalledWith(expect.any(Date), 200);
    expect(await res.json()).toEqual({ users: 0, sent: 0, failed: 0 });
  });
});
