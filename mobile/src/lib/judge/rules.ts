/**
 * Limits for answers, matching the server's checker (src/app/problems/judge-actions.ts and the /submissions route).
 * The server enforces them too; checking here gives the learner an answer before anything is queued.
 */
export const MAX_OUTPUT_CHARS = 20_000;
export const MAX_OUTPUTS = 100;

export type OutputCheck = { ok: true } | { ok: false; error: string };

export function checkOutputs(outputs: string[]): OutputCheck {
  if (outputs.length === 0 || outputs.length > MAX_OUTPUTS) return { ok: false, error: `Enter between 1 and ${MAX_OUTPUTS} outputs.` };
  for (let i = 0; i < outputs.length; i++) {
    if (outputs[i]!.length > MAX_OUTPUT_CHARS) return { ok: false, error: `Output ${i + 1} is longer than ${MAX_OUTPUT_CHARS.toLocaleString("en-US")} characters.` };
  }
  return { ok: true };
}

/** The wording used for every judged result. It must never suggest that code was run. */
export const JUDGE_NOTE = "The server compares the text you entered with the expected output. It does not run your code.";
