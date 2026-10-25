/** Mistake validation, a copy of the website's parseMistake rules applied to a plain object (the app sends JSON, not a form). */
export const MISTAKE_TYPES = ["CONCEPTUAL", "IMPLEMENTATION", "COMPLEXITY", "EDGE_CASE", "MISREAD", "DEBUGGING", "TIME_MANAGEMENT"] as const;
export const REASONS = ["COULD_NOT_SOLVE", "SOLVED_AFTER_EDITORIAL", "SOLVED_AFTER_HINT", "IMPLEMENTATION_ERROR", "MISUNDERSTOOD", "RAN_OUT_OF_TIME"] as const;

export type MistakeFields = {
  type: string;
  reason?: string | null;
  problemId?: string | null;
  outsideTitle?: string | null;
  outsideUrl?: string | null;
  misunderstood: string;
  correctIdea: string;
  recognizeNextTime: string;
};

export type MistakeCheck = { ok: true } | { ok: false; error: string };

export function checkMistake(f: MistakeFields): MistakeCheck {
  if (!(MISTAKE_TYPES as readonly string[]).includes(f.type)) return { ok: false, error: "Choose a mistake type." };
  if (f.reason && !(REASONS as readonly string[]).includes(f.reason)) return { ok: false, error: "Unknown reason." };
  for (const v of [f.misunderstood, f.correctIdea, f.recognizeNextTime]) {
    if (v.trim().length < 3 || v.length > 2000) return { ok: false, error: "Each text field needs 3-2000 characters." };
  }
  const outsideTitle = (f.outsideTitle ?? "").trim();
  if (f.problemId && outsideTitle) return { ok: false, error: "Pick a problem from the list or type one outside the site, not both." };
  if (outsideTitle && (outsideTitle.length < 2 || outsideTitle.length > 120)) return { ok: false, error: "The outside problem's title needs 2-120 characters." };
  if (!outsideTitle && f.outsideUrl) return { ok: false, error: "Add a title for the outside problem, or leave the link empty." };
  if (f.outsideUrl) {
    if (f.outsideUrl.length > 300) return { ok: false, error: "The link is too long (300 characters at most)." };
    let u: URL;
    try { u = new URL(f.outsideUrl); } catch { return { ok: false, error: "Enter a valid link, starting with https://." }; }
    if (u.protocol !== "https:") return { ok: false, error: "The link must start with https://." };
  }
  return { ok: true };
}
