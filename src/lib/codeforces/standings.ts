/** Pure: reads a Codeforces contest.standings response. No network, so it can be tested directly. */
export type StandingRow = { handle: string; rank: number; points: number; penalty: number; solved: number };
export type Standings = { contest: { name: string; phase: string }; rows: StandingRow[] };

type Obj = Record<string, unknown>;

export function parseStandings(data: Obj): Standings {
  const contest = (data.contest ?? {}) as Obj;
  const rows = ((data.rows as Obj[] | undefined) ?? []).map((r) => {
    const members = ((r.party as Obj | undefined)?.members as Obj[] | undefined) ?? [];
    const results = (r.problemResults as Obj[] | undefined) ?? [];
    return {
      handle: String(members[0]?.handle ?? ""),
      rank: Number(r.rank),
      points: Number(r.points),
      penalty: Number(r.penalty ?? 0),
      solved: results.filter((p) => Number(p.points) > 0).length,
    };
  });
  return { contest: { name: String(contest.name ?? "Contest"), phase: String(contest.phase ?? "") }, rows };
}
