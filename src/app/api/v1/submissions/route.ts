import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SYNC, parseWith, readJson } from "@/lib/api/http";
import { authenticate } from "@/lib/api/mobile-auth";
import { submissionSchema, submit } from "@/lib/mobile/submissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/v1/submissions with { problemId, clientId, output }. Compares pasted output with the stored expected outputs, exactly
 * like the website's "Check your answer". It does not run code. Authenticated before any test data is read.
 */
export const POST = handle(async (request) => {
  const { user } = await authenticate(request); // before anything about the problem is read
  const input = parseWith(submissionSchema, await readJson(request, MAX_BODY_SYNC));
  return json(await submit(user.id, input));
});
