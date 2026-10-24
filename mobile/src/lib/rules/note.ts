/** Tag rules for notes, matching the server's note schema: up to 5 tags, each 1-24 characters of a-z, 0-9 and dashes. */
export type TagResult = { ok: true; tags: string[] } | { ok: false; error: string };

export function parseTags(input: string): TagResult {
  const parts = input.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
  const tags = [...new Set(parts)];
  if (tags.length > 5) return { ok: false, error: "Use up to 5 tags." };
  if (tags.some((t) => !/^[a-z0-9-]{1,24}$/.test(t))) return { ok: false, error: "Tags use letters, numbers and dashes only, up to 24 characters." };
  return { ok: true, tags };
}

export const NOTE_TITLE_MAX = 120;
export const NOTE_BODY_MAX = 20_000;

export function checkNote(title: string, body: string): { ok: true } | { ok: false; error: string } {
  if (title.trim().length === 0) return { ok: false, error: "Give the note a title." };
  if (title.trim().length > NOTE_TITLE_MAX) return { ok: false, error: `The title can be ${NOTE_TITLE_MAX} characters at most.` };
  if (body.trim().length === 0) return { ok: false, error: "Write something in the note." };
  if (body.trim().length > NOTE_BODY_MAX) return { ok: false, error: `The note can be ${NOTE_BODY_MAX.toLocaleString("en-US")} characters at most.` };
  return { ok: true };
}
