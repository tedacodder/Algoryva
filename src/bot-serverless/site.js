// Client for the website's internal bot API. Every call is signed, has a timeout, and is never retried automatically, because some
// calls change state. Response bodies are never logged: a link or a chat id is personal.
import { signedHeaders } from "./sign.js";

const TIMEOUT_MS = 10_000;
const enc = new TextEncoder();

export class SiteError extends Error {
  constructor(status, code) {
    super(`site error ${code} (${status})`);
    this.status = status;
    this.code = code;
  }
}

export function createSite({ base, secret, fetchImpl = fetch }) {
  async function post(endpoint, body = {}, { timeoutMs = TIMEOUT_MS } = {}) {
    const path = `/api/internal/bot/v1/${endpoint}`;
    const raw = enc.encode(JSON.stringify(body));
    let res;
    try {
      res = await fetchImpl(new URL(path, base), {
        method: "POST",
        headers: { "content-type": "application/json", ...(await signedHeaders(secret, "POST", path, raw)) },
        body: raw,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });
    } catch {
      throw new SiteError(0, "unreachable");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (res.status >= 400) throw new SiteError(res.status, data?.error?.code ?? "error");
    if (data === null || typeof data !== "object") throw new SiteError(res.status, "bad_response");
    return data;
  }

  return {
    start: (chatId) => post("community/start", { chatId }),
    daily: (chatId) => post("community/daily", { chatId }),
    contests: (chatId) => post("community/contests", { chatId }),
    random: (chatId, filter = {}) => post("community/random", { chatId, ...filter }),
    connect: (chatId, chatType, handle) => post("community/connect", { chatId, chatType, handle }),
    disconnect: (chatId, handle) => post("community/disconnect", handle ? { chatId, handle } : { chatId }),
    me: (chatId) => post("community/me", { chatId }),
    group: (chatId, enable) => post("community/group", { chatId, enable }),
    settings: (chatId, patch) => post("community/settings", { chatId, ...patch }),
    stop: (chatId) => post("community/stop", { chatId }),
    due: () => post("notifications/due"),
    ack: (deliveryId, outcome) => post("notifications/ack", { deliveryId, outcome }),
    roster: (chatId, action, handles) => post("community/roster", handles ? { chatId, action, handles } : { chatId, action }),
    groupProblem: (chatId, problem) => post("community/group-problem", { chatId, problem }),
    // A report can check up to 12 Codeforces handles, which takes about 30 seconds with Codeforces' rate limit.
    groupReport: (chatId) => post("community/group-report", { chatId }, { timeoutMs: 60_000 }),
  };
}
