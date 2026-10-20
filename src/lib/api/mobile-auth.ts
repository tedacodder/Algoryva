import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * Mobile bearer tokens. They live in the existing Session table, but are hashed with a domain prefix, so a web cookie
 * value can never match a mobile row and a mobile token can never match a web row (the web hashes the bare value).
 * Password reset, admin suspension and account deletion already delete Session rows, which revokes these tokens too.
 */
export const MOBILE_TOKEN_PREFIX = "alv_";
export const MOBILE_SESSION_TTL_MS = 30 * 86_400_000; // the same 30 days as a web session
const DOMAIN = "algoryva-mobile-v1:";
const TOKEN_SHAPE = /^alv_[A-Za-z0-9_-]{43}$/; // 32 random bytes as unpadded base64url is 43 characters

export const hashMobileToken = (token: string): string => createHash("sha256").update(DOMAIN + token).digest("hex");
export const generateMobileToken = (): string => MOBILE_TOKEN_PREFIX + randomBytes(32).toString("base64url");

/** Strict: exactly "Bearer <token>" with the token shape above. Anything else is treated as no credentials. */
export function bearerToken(request: Request): string | null {
  const m = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  return m && TOKEN_SHAPE.test(m[1]) ? m[1] : null;
}

/** "Algoryva app on <name>" with a sanitised, length-limited name, or a fixed label. Feeds the website's new-device alert. */
export function mobileDeviceLabel(deviceName?: string | null): string {
  const clean = (deviceName ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  return clean ? `Algoryva app on ${clean}` : "Algoryva Android app";
}

export async function createMobileSession(userId: string, device: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateMobileToken();
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hashMobileToken(token), expiresAt, device } });
  return { token, expiresAt };
}

export type MobileUser = { id: string; email: string; username: string; role: "USER" | "ADMIN"; preferredLanguage: string; emailVerifiedAt: Date | null };

const UNAUTHORIZED = () => new ApiError(401, "unauthorized", "Sign in to continue.");

/**
 * Resolves the bearer token to a user, or throws one identical 401 for every failure (missing, malformed, unknown,
 * expired, suspended), so a caller learns nothing about why. Expiry is checked on every request.
 */
export async function authenticate(request: Request): Promise<{ user: MobileUser; tokenHash: string }> {
  const token = bearerToken(request);
  if (!token) throw UNAUTHORIZED();
  const tokenHash = hashMobileToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, user: { select: { id: true, email: true, username: true, role: true, suspended: true, preferredLanguage: true, emailVerifiedAt: true } } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.suspended) throw UNAUTHORIZED();
  const u = session.user;
  return { user: { id: u.id, email: u.email, username: u.username, role: u.role, preferredLanguage: u.preferredLanguage, emailVerifiedAt: u.emailVerifiedAt }, tokenHash };
}

export function publicUser(u: { id: string; email: string; username: string; preferredLanguage: string; emailVerifiedAt: Date | null }) {
  return { id: u.id, email: u.email, username: u.username, emailVerified: Boolean(u.emailVerifiedAt), preferredLanguage: u.preferredLanguage };
}
