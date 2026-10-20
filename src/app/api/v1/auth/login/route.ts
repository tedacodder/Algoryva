import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith, readJson } from "@/lib/api/http";
import { createMobileSession, mobileDeviceLabel, publicUser } from "@/lib/api/mobile-auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { classifyDevice } from "@/lib/auth/device";
import { knownDevices } from "@/lib/auth/session";
import { parseLogin } from "@/lib/auth/validation";
import { sendNewSignInEmail } from "@/lib/auth/account-mail";
import { anyBlocked, recordAll, trustedClientIp, type Limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ email: z.string().max(320), password: z.string().max(256), deviceName: z.string().max(100).optional() }).strict();

/** POST /api/v1/auth/login. Same keys, limits, neutral error and timing behaviour as the website's login action. */
export const POST = handle(async (request) => {
  const body = parseWith(schema, await readJson(request, MAX_BODY_SMALL));
  const form = new FormData();
  form.set("email", body.email); form.set("password", body.password);
  const parsed = parseLogin(form);
  if (!parsed.ok) throw new ApiError(400, "invalid_request", parsed.error);

  // The website's keys and limits, unchanged, so a lockout applies across web and app alike.
  const ip = await trustedClientIp();
  const limits: Limit[] = [{ key: `login-email:${parsed.value.email}`, max: 5, windowMs: 15 * 60_000 }];
  if (ip) limits.push({ key: `login-ip:${ip}`, max: 20, windowMs: 15 * 60_000 });
  if (await anyBlocked(limits)) throw new ApiError(429, "rate_limited", "Too many failed attempts. Try again in 15 minutes.", { "Retry-After": "900" });

  const user = await db.user.findUnique({ where: { email: parsed.value.email } });
  if (!user) await hashPassword(parsed.value.password); // keep timing similar for unknown emails
  const ok = user && !user.suspended && (await verifyPassword(parsed.value.password, user.passwordHash));
  if (!user || !ok) {
    await recordAll(limits.map((l) => l.key));
    throw new ApiError(401, "invalid_credentials", "Invalid email or password.");
  }
  const device = mobileDeviceLabel(body.deviceName);
  const status = classifyDevice(await knownDevices(user.id), device);
  const { token, expiresAt } = await createMobileSession(user.id, device);
  // Warn the owner about a sign-in from a device this account has not used before. A mail failure never blocks sign-in.
  if (status === "new") { try { await sendNewSignInEmail(user.email, device); } catch { /* ignore */ } }
  return json({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) });
});
