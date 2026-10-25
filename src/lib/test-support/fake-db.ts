/**
 * An in-memory stand-in for the parts of the Prisma client that the mobile API uses. It exists so that tests can check idempotency,
 * rollback, ownership and cascades against real state instead of call counts. It is NOT a database: it does not run Postgres,
 * Prisma or SQL, so it proves nothing about the real engine, locks, isolation levels or migrations (those are checked separately,
 * or reported as not run). What it does model:
 *   - unique keys (a duplicate create throws P2002, createMany skipDuplicates skips),
 *   - composite where keys such as userId_topicId, and the filters the code uses (not, in, lte, gt, startsWith, OR),
 *   - $transaction(callback): transactions run one at a time (like waiting on a primary-key conflict) and ROLL BACK on a throw,
 *   - ON DELETE CASCADE from User to every user-owned table (as verified in the migration SQL).
 * `include`/`select` are ignored: rows come back whole, so seed nested data (e.g. problem.testCases) directly on the row.
 */
type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

const COMPOSITE: Record<string, string[]> = {
  userId_id: ["userId", "id"], userId_topicId: ["userId", "topicId"], userId_problemId: ["userId", "problemId"], userId_outsideKey: ["userId", "outsideKey"],
};
const UNIQUE: Record<string, string[][]> = {
  user: [["id"], ["email"], ["username"]], session: [["id"], ["tokenHash"]], topic: [["id"], ["slug"]], problem: [["id"], ["slug"]],
  topicProgress: [["userId", "topicId"]], reviewItem: [["id"], ["userId", "topicId"]], quizResult: [["userId", "topicId"]],
  problemSolve: [["userId", "problemId"]], activity: [["id"]], mistake: [["id"]], note: [["id"]],
  revisit: [["id"], ["userId", "problemId"], ["userId", "outsideKey"]], syncEvent: [["userId", "id"]], authAttempt: [["id"]],
};
const HAS_ID = new Set(["session", "reviewItem", "activity", "mistake", "note", "revisit", "authAttempt", "user", "topic", "problem"]);
const CASCADE_FROM_USER = ["session", "topicProgress", "reviewItem", "quizResult", "problemSolve", "activity", "mistake", "note", "revisit", "syncEvent"];
export const TABLES = Object.keys(UNIQUE);

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
const cmp = (a: unknown, b: unknown): number => (a instanceof Date && b instanceof Date ? a.getTime() - b.getTime() : (a as number) < (b as number) ? -1 : (a as number) > (b as number) ? 1 : 0);

function flatten(where: Where): Where {
  const out: Where = {};
  for (const [k, v] of Object.entries(where)) {
    if (COMPOSITE[k] && isPlain(v)) Object.assign(out, v);
    else out[k] = v;
  }
  return out;
}

function matches(row: Row, where: Where): boolean {
  for (const [k, v] of Object.entries(flatten(where))) {
    if (k === "OR") { if (!(v as Where[]).some((w) => matches(row, w))) return false; continue; }
    if (k === "AND") { if (!(v as Where[]).every((w) => matches(row, w))) return false; continue; }
    const val = row[k];
    if (isPlain(v)) {
      if ("not" in v && (v.not === null ? val === null || val === undefined : same(val, v.not))) return false;
      if ("in" in v && !(v.in as unknown[]).some((x) => same(x, val))) return false;
      if ("lte" in v && !(val != null && cmp(val, v.lte) <= 0)) return false;
      if ("lt" in v && !(val != null && cmp(val, v.lt) < 0)) return false;
      if ("gte" in v && !(val != null && cmp(val, v.gte) >= 0)) return false;
      if ("gt" in v && !(val != null && cmp(val, v.gt) > 0)) return false;
      if ("startsWith" in v && !(typeof val === "string" && val.startsWith(v.startsWith as string))) return false;
      if ("endsWith" in v && !(typeof val === "string" && val.endsWith(v.endsWith as string))) return false;
    } else if (!same(val, v)) return false;
  }
  return true;
}

function applyData(row: Row, data: Row): void {
  for (const [k, v] of Object.entries(data)) {
    if (isPlain(v) && "increment" in v) row[k] = (Number(row[k]) || 0) + Number(v.increment);
    else row[k] = v;
  }
}

class Table {
  rows: Row[] = [];
  constructor(readonly name: string, private readonly db: FakeDb) {}

  private conflict(row: Row, ignore?: Row): boolean {
    return (UNIQUE[this.name] ?? []).some((fields) => fields.every((f) => row[f] !== undefined && row[f] !== null) && this.rows.some((r) => r !== ignore && fields.every((f) => same(r[f], row[f]))));
  }
  private build(data: Row): Row {
    const row: Row = { ...data };
    if (HAS_ID.has(this.name) && row.id === undefined) row.id = crypto.randomUUID();
    if (row.createdAt === undefined && ["session", "activity", "mistake", "note", "syncEvent", "authAttempt", "user", "revisit"].includes(this.name)) row.createdAt = new Date();
    if (this.name === "problemSolve" && row.solvedAt === undefined) row.solvedAt = new Date();
    if (this.name === "quizResult" && row.attempts === undefined) row.attempts = 1; // @default(1) in the schema
    if (this.name === "user") for (const [k, v] of Object.entries({ role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null })) if (row[k] === undefined) row[k] = v; // schema defaults
    if (this.name === "revisit") for (const k of ["problemId", "outsideKey", "outsideTitle", "outsideUrl", "dueAt", "passedAt", "passedBy", "note"]) if (row[k] === undefined) row[k] = null;
    return row;
  }
  private err(code: string): Error { return Object.assign(new Error(`${this.name}: ${code}`), { code }); }
  private fault(op: string) { this.db.checkFault(`${this.name}.${op}`); }
  private find(where: Where) { return this.rows.filter((r) => matches(r, where)); }

  /** Resolves `select: { user: ... }` / `include: { user: true }` from the user table (the only relation the mobile code reads). */
  private withRelations(r: Row, a: { select?: Record<string, unknown>; include?: Record<string, unknown> }): Row {
    if ((a.select?.user || a.include?.user) && r.userId !== undefined) {
      const u = this.db.t.user.rows.find((x) => x.id === r.userId);
      return { ...r, user: u ? { ...u } : null };
    }
    return { ...r };
  }
  async findUnique(a: { where: Where; select?: Record<string, unknown>; include?: Record<string, unknown> }) { this.fault("findUnique"); const r = this.find(a.where)[0]; return r ? this.withRelations(r, a) : null; }
  async findFirst(a: { where?: Where } = {}) { this.fault("findFirst"); const r = this.find(a.where ?? {})[0]; return r ? { ...r } : null; }
  async findMany(a: { where?: Where; take?: number } = {}) { this.fault("findMany"); const rs = this.find(a.where ?? {}).map((r) => ({ ...r })); return a.take ? rs.slice(0, a.take) : rs; }
  async count(a: { where?: Where } = {}) { this.fault("count"); return this.find(a.where ?? {}).length; }
  async create(a: { data: Row }) {
    this.fault("create");
    const row = this.build(a.data);
    if (this.conflict(row)) throw this.err("P2002");
    this.rows.push(row);
    return { ...row };
  }
  async createMany(a: { data: Row[]; skipDuplicates?: boolean }) {
    this.fault("createMany");
    let count = 0;
    for (const d of a.data) {
      const row = this.build(d);
      if (this.conflict(row)) { if (a.skipDuplicates) continue; throw this.err("P2002"); }
      this.rows.push(row); count++;
    }
    return { count };
  }
  async update(a: { where: Where; data: Row }) {
    this.fault("update");
    const r = this.find(a.where)[0];
    if (!r) throw this.err("P2025");
    applyData(r, a.data);
    return { ...r };
  }
  async updateMany(a: { where?: Where; data: Row }) {
    this.fault("updateMany");
    const rs = this.find(a.where ?? {});
    rs.forEach((r) => applyData(r, a.data));
    return { count: rs.length };
  }
  async upsert(a: { where: Where; create: Row; update: Row }) {
    this.fault("upsert");
    const r = this.find(a.where)[0];
    if (r) { applyData(r, a.update); return { ...r }; }
    return this.create({ data: a.create });
  }
  async delete(a: { where: Where }) {
    this.fault("delete");
    const r = this.find(a.where)[0];
    if (!r) throw this.err("P2025");
    this.rows = this.rows.filter((x) => x !== r);
    if (this.name === "user") for (const t of CASCADE_FROM_USER) this.db.t[t].rows = this.db.t[t].rows.filter((x) => x.userId !== r.id);
    return { ...r };
  }
  async deleteMany(a: { where?: Where } = {}) {
    this.fault("deleteMany");
    const rs = this.find(a.where ?? {});
    this.rows = this.rows.filter((x) => !rs.includes(x));
    return { count: rs.length };
  }
}

export class FakeDb {
  t: Record<string, Table> = {};
  private faults = new Map<string, number>();
  private queue: Promise<unknown> = Promise.resolve();
  transactions = 0;
  user!: Table; session!: Table; topic!: Table; problem!: Table; topicProgress!: Table; reviewItem!: Table; quizResult!: Table;
  problemSolve!: Table; activity!: Table; mistake!: Table; note!: Table; revisit!: Table; syncEvent!: Table; authAttempt!: Table;

  constructor() { this.reset(); }

  reset(): void {
    this.faults.clear();
    this.queue = Promise.resolve();
    this.transactions = 0;
    for (const name of TABLES) { const t = new Table(name, this); this.t[name] = t; (this as unknown as Record<string, Table>)[name] = t; }
  }
  /** Make the next `times` calls of "table.operation" throw an infrastructure-style error. */
  failNext(op: string, times = 1): void { this.faults.set(op, times); }
  checkFault(op: string): void {
    const n = this.faults.get(op);
    if (n) { this.faults.set(op, n - 1); throw new Error(`injected failure: ${op}`); }
  }
  rows(table: string): Row[] { return this.t[table].rows; }
  seed(table: string, rows: Row[]): void { for (const r of rows) this.t[table].rows.push({ ...r }); }

  /** Transactions run one at a time and roll back on a throw. An array form just awaits its operations. */
  $transaction<T>(arg: ((tx: FakeDb) => Promise<T>) | Promise<unknown>[]): Promise<T> {
    if (Array.isArray(arg)) return Promise.all(arg) as Promise<T>;
    const run = async (): Promise<T> => {
      this.transactions++;
      const snapshot = new Map(Object.entries(this.t).map(([k, t]) => [k, t.rows.map((r) => ({ ...r }))]));
      try {
        return await arg(this);
      } catch (e) {
        for (const [k, rows] of snapshot) this.t[k].rows = rows;
        throw e;
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
  /** Stands in for `SELECT id FROM "User" WHERE role = 'ADMIN' FOR UPDATE`. Row locks are not modelled. */
  async $queryRaw(): Promise<{ id: string }[]> { return this.t.user.rows.filter((u) => u.role === "ADMIN").map((u) => ({ id: u.id as string })); }
}

export const fakeDb = new FakeDb();
