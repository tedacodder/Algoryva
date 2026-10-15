import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { describeDevice } from "@/lib/auth/device";

const COOKIE = "session";
const TTL_MS = 30 * 86_400_000;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

/** The label for the device making this request, from its User-Agent. */
export async function currentDevice(): Promise<string> {
  return describeDevice((await headers()).get("user-agent"));
}

/** Distinct device labels this account has signed in from (expired sessions included, which is what "used before" means). */
export async function knownDevices(userId: string): Promise<string[]> {
  const rows = await db.session.findMany({ where: { userId, device: { not: null } }, select: { device: true }, distinct: ["device"], take: 100 });
  return rows.map((r) => r.device).filter((d): d is string => d !== null);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  const device = await currentDevice();
  await db.session.create({ data: { userId, tokenHash: sha(token), expiresAt, device } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha(token) },
    select: { expiresAt: true, user: { select: { id: true, email: true, username: true, role: true, suspended: true, onboarded: true, preferredLanguage: true, emailVerifiedAt: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.suspended) return null;
  return session.user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(COOKIE);
}

/** Server-side authorization guards. Never rely on client checks. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
