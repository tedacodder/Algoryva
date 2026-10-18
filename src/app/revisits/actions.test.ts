import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ selfReportRevisit: vi.fn(), requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/revisit-store", () => ({ selfReportRevisit: m.selfReportRevisit }));

import { reportOutsideRevisit } from "./actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  m.requireUser.mockResolvedValue({ id: "u1" });
});

describe("reportOutsideRevisit", () => {
  it("refuses an explanation that is too short to show understanding", async () => {
    const r = await reportOutsideRevisit(undefined, form({ id: "r1", note: "I get it now" }));
    expect(r?.error).toContain("Explain the idea");
    expect(m.selfReportRevisit).not.toHaveBeenCalled();
  });
  it("refuses a missing revisit id", async () => {
    const r = await reportOutsideRevisit(undefined, form({ note: "Sort by end time, then greedily keep the earliest end." }));
    expect(r?.error).toBe("Choose a revisit.");
  });
  it("tells the learner when the revisit is not due or is a site problem", async () => {
    m.selfReportRevisit.mockResolvedValue(0);
    const r = await reportOutsideRevisit(undefined, form({ id: "r1", note: "Sort by end time, then greedily keep the earliest end." }));
    expect(r?.error).toContain("not due yet");
  });
  it("records the report as self-reported, not as verified", async () => {
    m.selfReportRevisit.mockResolvedValue(1);
    const r = await reportOutsideRevisit(undefined, form({ id: "r1", note: "  Sort by end time, then greedily keep the earliest end.  " }));
    expect(m.selfReportRevisit).toHaveBeenCalledWith("u1", "r1", "Sort by end time, then greedily keep the earliest end.", expect.any(Date));
    expect(r?.message).toContain("your own report, not a verified solve");
  });
});
