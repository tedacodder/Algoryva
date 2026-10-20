import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { byCode, canonicalJson, sha256Base64Url } from "@/lib/mobile/canonical";

/**
 * Sync pull: the user's server-side state as a snapshot, identified by a fingerprint. The website writes this data through
 * many code paths (and a daily job, and admin deletions that cascade), none of which record changes, so instead of tracking
 * changes the server hashes the values themselves.
 *
 *  - The fingerprint is a hash of the canonical serialisation of EVERY synchronised value, note and mistake bodies included.
 *    It changes whenever any of them changes, however the change was made, deletions included, and it does not depend on
 *    row order, clocks or timestamps.
 *  - All reads happen in one REPEATABLE READ transaction, so the state and its fingerprint are one consistent snapshot.
 *  - Notes and mistakes are sent in pages by id. A page token names the user, the fingerprint and the position and is checked
 *    on every request. If the state changed between pages the answer is 409 state_changed and the client restarts.
 *
 * Cost, by design: a pull reads all of the user's rows (including note bodies, to fingerprint them) and, when the state has
 * changed, sends all of it, split into pages. A delta protocol would move less data, but needs a change log that existing
 * website writes would have to feed. See docs/MOBILE_API.md.
 */
export const NOTES_PER_PAGE = 100;
export const MISTAKES_PER_PAGE = 200;

const FINGERPRINT = /^[A-Za-z0-9_-]{22}$/;
export const sinceSchema = z.string().regex(FINGERPRINT);

type PageToken = { v: 1; u: string; f: string; n: string | null; m: string | null };
const checksum = (t: PageToken) => sha256Base64Url(`${t.v}|${t.u}|${t.f}|${t.n ?? ""}|${t.m ?? ""}`, 8);

export function encodePageToken(t: PageToken): string {
  return Buffer.from(JSON.stringify({ ...t, c: checksum(t) })).toString("base64url");
}

/**
 * Tokens are not signed (there is no secret to sign with, and adding one is out of scope). They do not need to be: a token
 * only says where to continue, every query is filtered by the authenticated user, and the fingerprint is recomputed. The
 * checksum catches accidental corruption. Everything else is validated against the authenticated user and current state.
 */
export function decodePageToken(raw: string, userId: string): PageToken {
  const bad = () => new ApiError(400, "invalid_request", "The page token is not valid.");
  if (raw.length > 400) throw bad();
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")); } catch { throw bad(); }
  const r = z.object({ v: z.literal(1), u: z.string(), f: z.string().regex(FINGERPRINT), n: z.string().max(80).nullable(), m: z.string().max(80).nullable(), c: z.string() }).strict().safeParse(parsed);
  if (!r.success) throw bad();
  const { c, ...t } = r.data;
  if (c !== checksum(t) || t.u !== userId) throw bad();
  return t;
}

export type PullResponse =
  | { cursor: string; unchanged: true }
  | { cursor: string; unchanged: false; state: SmallState | null; notes: NoteOut[]; mistakes: MistakeOut[]; next: string | null };

type NoteOut = { id: string; title: string; body: string; tags: string[]; createdAt: string };
type MistakeOut = { id: string; problemId: string | null; outsideTitle: string | null; outsideUrl: string | null; type: string; reason: string | null; misunderstood: string; correctIdea: string; recognizeNextTime: string; createdAt: string };
type SmallState = {
  topicProgress: { slug: string; completedAt: string | null }[];
  reviewItems: { slug: string; step: number; dueAt: string }[];
  quizResults: { slug: string; bestScore: number; total: number; attempts: number; passedAt: string | null }[];
  solves: { problemId: string; solvedAt: string }[];
  revisits: { id: string; problemId: string | null; outsideTitle: string | null; outsideUrl: string | null; dueAt: string | null; step: number; passedAt: string | null; passedBy: string | null; note: string | null }[];
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export type Snapshot = { fingerprint: string; state: SmallState; notes: NoteOut[]; mistakes: MistakeOut[] };

/** Reads the whole snapshot in one consistent transaction and fingerprints it. */
export async function readSnapshot(userId: string): Promise<Snapshot> {
  const raw = await db.$transaction(async (tx) => {
    const topics = await tx.topic.findMany({ select: { id: true, slug: true } });
    const progress = await tx.topicProgress.findMany({ where: { userId }, select: { topicId: true, completedAt: true } });
    const reviews = await tx.reviewItem.findMany({ where: { userId }, select: { topicId: true, step: true, dueAt: true } });
    const quizzes = await tx.quizResult.findMany({ where: { userId }, select: { topicId: true, bestScore: true, total: true, attempts: true, passedAt: true } });
    const solves = await tx.problemSolve.findMany({ where: { userId }, select: { problemId: true, solvedAt: true } });
    const revisits = await tx.revisit.findMany({ where: { userId }, select: { id: true, problemId: true, outsideTitle: true, outsideUrl: true, dueAt: true, step: true, passedAt: true, passedBy: true, note: true } });
    const notes = await tx.note.findMany({ where: { userId }, select: { id: true, title: true, body: true, tags: true, createdAt: true } });
    const mistakes = await tx.mistake.findMany({ where: { userId }, select: { id: true, problemId: true, outsideTitle: true, outsideUrl: true, type: true, reason: true, misunderstood: true, correctIdea: true, recognizeNextTime: true, createdAt: true } });
    return { topics, progress, reviews, quizzes, solves, revisits, notes, mistakes };
  }, { isolationLevel: "RepeatableRead", maxWait: 5_000, timeout: 20_000 });

  const slugOf = new Map(raw.topics.map((t) => [t.id, t.slug]));
  const withSlug = <T extends { topicId: string }>(rows: T[]) => rows.flatMap((r) => { const slug = slugOf.get(r.topicId); return slug ? [{ r, slug }] : []; });
  const bySlug = <T extends { slug: string }>(a: T, b: T) => byCode(a.slug, b.slug);

  const state: SmallState = {
    topicProgress: withSlug(raw.progress).map(({ r, slug }) => ({ slug, completedAt: iso(r.completedAt) })).sort(bySlug),
    reviewItems: withSlug(raw.reviews).map(({ r, slug }) => ({ slug, step: r.step, dueAt: r.dueAt.toISOString() })).sort(bySlug),
    quizResults: withSlug(raw.quizzes).map(({ r, slug }) => ({ slug, bestScore: r.bestScore, total: r.total, attempts: r.attempts, passedAt: iso(r.passedAt) })).sort(bySlug),
    solves: raw.solves.map((s) => ({ problemId: s.problemId, solvedAt: s.solvedAt.toISOString() })).sort((a, b) => byCode(a.problemId, b.problemId)),
    revisits: raw.revisits.map((r) => ({ id: r.id, problemId: r.problemId, outsideTitle: r.outsideTitle, outsideUrl: r.outsideUrl, dueAt: iso(r.dueAt), step: r.step, passedAt: iso(r.passedAt), passedBy: r.passedBy, note: r.note })).sort((a, b) => byCode(a.id, b.id)),
  };
  const notes: NoteOut[] = raw.notes.map((n) => ({ id: n.id, title: n.title, body: n.body, tags: [...n.tags], createdAt: n.createdAt.toISOString() })).sort((a, b) => byCode(a.id, b.id));
  const mistakes: MistakeOut[] = raw.mistakes.map((m) => ({ id: m.id, problemId: m.problemId, outsideTitle: m.outsideTitle, outsideUrl: m.outsideUrl, type: m.type, reason: m.reason, misunderstood: m.misunderstood, correctIdea: m.correctIdea, recognizeNextTime: m.recognizeNextTime, createdAt: m.createdAt.toISOString() })).sort((a, b) => byCode(a.id, b.id));

  // Every value that is sent is hashed, so any change to any of them (or a deletion) changes the fingerprint.
  const fingerprint = sha256Base64Url("snapshot-v1:" + canonicalJson({ state, notes, mistakes }));
  return { fingerprint, state, notes, mistakes };
}

/** The pull itself. `since` is the fingerprint the client last applied completely; `page` continues a pass already begun. */
export async function pull(userId: string, since: string | null, page: string | null): Promise<PullResponse> {
  const token = page ? decodePageToken(page, userId) : null;
  const snap = await readSnapshot(userId);
  if (token && token.f !== snap.fingerprint) throw new ApiError(409, "state_changed", "Your data changed while syncing. Start the sync again.");
  if (!token && since === snap.fingerprint) return { cursor: snap.fingerprint, unchanged: true };

  const after = (rows: { id: string }[], last: string | null) => (last === null ? rows : rows.filter((r) => byCode(r.id, last) > 0));
  const notePage = after(snap.notes, token?.n ?? null).slice(0, NOTES_PER_PAGE);
  const mistakePage = after(snap.mistakes, token?.m ?? null).slice(0, MISTAKES_PER_PAGE);
  const lastNote = notePage.length ? notePage[notePage.length - 1].id : token?.n ?? null;
  const lastMistake = mistakePage.length ? mistakePage[mistakePage.length - 1].id : token?.m ?? null;
  const more = after(snap.notes, lastNote).length > 0 || after(snap.mistakes, lastMistake).length > 0;
  const next = more ? encodePageToken({ v: 1, u: userId, f: snap.fingerprint, n: lastNote, m: lastMistake }) : null;

  return { cursor: snap.fingerprint, unchanged: false, state: token ? null : snap.state, notes: notePage as NoteOut[], mistakes: mistakePage as MistakeOut[], next };
}
