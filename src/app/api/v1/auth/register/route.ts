import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith, readJson } from "@/lib/api/http";
import { createMobileSession, mobileDeviceLabel, publicUser } from "@/lib/api/mobile-auth";
import { hashPassword } from "@/lib/auth/password";
import { parseRegister } from "@/lib/auth/validation";
import { sendVerificationEmail } from "@/lib/auth/account-mail";
import { HOUR, anyBlocked, recordAll, trustedClientIp, type Limit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ email: z.string().max(320), username: z.string().max(64), password: z.string().max(256), deviceName: z.string().max(100).optional() }).strict();

/** POST /api/v1/auth/register. Same validation, limits and messages as the website's register action. */
export const POST = handle(async (request) => {
  const body = parseWith(schema, await readJson(request, MAX_BODY_SMALL));
  // The website's own parser, on the same fields, so the rules cannot differ.
  const form = new FormData();
  form.set("email", body.email); form.set("username", body.username); form.set("password", body.password);
  const parsed = parseRegister(form);
  if (!parsed.ok) throw new ApiError(400, "invalid_request", parsed.error);
  const { email, username, password } = parsed.value;

  // Per-email limit always applies. A per-IP limit is added only when a trusted proxy IP is available (TRUST_PROXY).
  const ip = await trustedClientIp();
  const limits: Limit[] = [{ key: `register-email:${email}`, max: 30, windowMs: HOUR }];
  if (ip) limits.push({ key: `register-ip:${ip}`, max: 30, windowMs: HOUR });
  if (await anyBlocked(limits)) throw new ApiError(429, "rate_limited", "Too many sign-up attempts. Try again later.", { "Retry-After": String(HOUR / 1000) });
  await recordAll(limits.map((l) => l.key));

  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { id: true } });
  const inUse = () => new ApiError(409, "account_exists", "That email or username is already in use.");
  if (taken) throw inUse();
  let user;
  try {
    user = await db.user.create({ data: { email, username, passwordHash: await hashPassword(password) } });
  } catch (e) {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") throw inUse(); // two registrations raced
    throw e;
  }
  try { await sendVerificationEmail(user.id, email); } catch { /* the website offers a resend; a mail failure never blocks sign-up */ }
  const { token, expiresAt } = await createMobileSession(user.id, mobileDeviceLabel(body.deviceName));
  return json({ token, expiresAt: expiresAt.toISOString(), user: publicUser(user) }, 201);
});
