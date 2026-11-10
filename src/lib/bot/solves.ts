import "server-only";
import { db } from "@/lib/db";
import { acceptedSubmissions } from "@/lib/codeforces/client";

export type SyncState = { syncedAt: Date; backfilled: boolean };
const key = (handle: string) => handle.toLowerCase();

export async function syncStates(handles: string[]): Promise<Map<string, SyncState>> {
  const rows = handles.length ? await db.cfSync.findMany({ where: { handle: { in: handles.map(key) } } }) : [];
  return new Map(rows.map((r) => [r.handle, { syncedAt: r.syncedAt, backfilled: r.backfilled }]));
}

/** Reads a handle's solves from Codeforces and stores what is new. The first accepted time of a problem is kept. */
export async function syncHandle(handle: string, now: Date, full: boolean): Promise<SyncState> {
  const name = key(handle);
  const solves = await acceptedSubmissions(handle, full);
  if (solves.length) {
    await db.cfSolve.createMany({
      data: solves.map((a) => ({ handle: name, problemRef: a.ref, acceptedAt: new Date(a.at * 1000) })),
      skipDuplicates: true,
    });
  }
  const previous = (await db.cfSync.findUnique({ where: { handle: name } }))?.backfilled ?? false;
  const state = { syncedAt: now, backfilled: full || previous };
  await db.cfSync.upsert({ where: { handle: name }, create: { handle: name, ...state }, update: state });
  return state;
}
