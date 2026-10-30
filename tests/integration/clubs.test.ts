import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { createClub, joinClub, leaveClub, myClub, clubBoard, validClubName } from "@/lib/bot/clubs";
import { weekStart } from "@/lib/bot/rewards";
import { deleteAccount } from "@/lib/account/delete";
import { hashPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/api/errors";

const PASSWORD = "correct horse battery staple";
let n = 0;
async function student(id: string) {
  await db.user.create({ data: { id, email: `${id}@example.test`, username: id, passwordHash: await hashPassword(PASSWORD) } });
}
async function solve(userId: string, difficulty: "EASY" | "MEDIUM", when: Date, verification: "OUTPUT_MATCHED" | "SELF_REPORTED" = "OUTPUT_MATCHED") {
  const p = await db.problem.create({ data: { slug: `cl-${++n}`, title: `CL ${n}`, kind: "INTERNAL", difficulty, status: "PUBLISHED" } });
  await db.problemSolve.create({ data: { userId, problemId: p.id, verification, solvedAt: when } });
}
const monday = () => new Date(weekStart(new Date()).getTime() + 3_600_000);

beforeEach(async () => {
  await resetDb();
  n = 0;
  for (const id of ["u-leader", "u-m1", "u-m2", "u-solo", "u-other"]) await student(id);
});

describe("club rules", () => {
  it("validates names: 3 to 40 allowed characters, nothing else", () => {
    expect(validClubName("ASTU CP")).toBe(true);
    expect(validClubName("Ab")).toBe(false);
    expect(validClubName("<script>")).toBe(false);
    expect(validClubName("x".repeat(41))).toBe(false);
  });

  it("creates a club with an invite code, and the creator is the leader", async () => {
    const club = await createClub("u-leader", "ASTU CP");
    expect(club.code).toMatch(/^[0-9a-f]{8}$/);
    expect((await myClub("u-leader", new Date()))?.isLeader).toBe(true);
  });

  it("one club per student: creating or joining a second one is refused", async () => {
    await createClub("u-leader", "First Club");
    await expect(createClub("u-leader", "Second Club")).rejects.toMatchObject({ code: "already_in_club" });
    const other = await createClub("u-other", "Other Club");
    await expect(joinClub("u-leader", other.code)).rejects.toMatchObject({ code: "already_in_club" });
  });

  it("joins with a code, and refuses an unknown code", async () => {
    const club = await createClub("u-leader", "ASTU CP");
    expect(await joinClub("u-m1", club.code)).toEqual({ name: "ASTU CP" });
    await expect(joinClub("u-m2", "00000000")).rejects.toBeInstanceOf(ApiError);
  });

  it("the leader cannot leave while members remain; a member can leave; a sole leader leaving deletes the club", async () => {
    const club = await createClub("u-leader", "ASTU CP");
    await joinClub("u-m1", club.code);
    await expect(leaveClub("u-leader")).rejects.toMatchObject({ code: "leader_must_stay" });
    expect(await leaveClub("u-m1")).toEqual({ left: true, club: "ASTU CP" });
    expect(await leaveClub("u-leader")).toEqual({ left: true, club: "ASTU CP" });
    expect(await db.club.count()).toBe(0);
  });

  it("leaving when not in a club is a no-op", async () => {
    expect(await leaveClub("u-solo")).toEqual({ left: false });
  });
});

describe("club score and board", () => {
  it("a club's weekly score is the sum of its members' verified points, not self-reported", async () => {
    const club = await createClub("u-leader", "ASTU CP");
    await joinClub("u-m1", club.code);
    await solve("u-leader", "EASY", monday());
    await solve("u-m1", "MEDIUM", monday());
    await solve("u-m1", "EASY", monday(), "SELF_REPORTED");
    const mine = await myClub("u-m1", new Date());
    expect(mine?.weekScore).toBe(3);
    expect(mine?.members).toBe(2);
  });

  it("the board lists clubs by score with names only, and hides clubs with no verified points", async () => {
    const a = await createClub("u-leader", "ASTU CP");
    await joinClub("u-m1", a.code);
    await createClub("u-solo", "Quiet Club");
    await solve("u-leader", "HARD" as "EASY", monday());
    const board = await clubBoard(new Date());
    expect(board.map((c) => c.name)).toEqual(["ASTU CP"]);
    expect(JSON.stringify(board)).not.toContain("u-leader");
    expect(Object.keys(board[0]).sort()).toEqual(["members", "name", "weekScore"]);
  });

  it("deleting a member removes their membership; deleting the leader deletes the club", async () => {
    const club = await createClub("u-leader", "ASTU CP");
    await joinClub("u-m1", club.code);
    await deleteAccount("u-m1", PASSWORD);
    expect((await myClub("u-leader", new Date()))?.members).toBe(1);
    await deleteAccount("u-leader", PASSWORD);
    expect(await db.club.count()).toBe(0);
  });
});
