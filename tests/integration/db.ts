import { PrismaClient } from "../../prisma/.generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Real PostgreSQL for integration tests. Refuses anything except a localhost database whose name ends in _test, so a mistaken
 * environment variable can never truncate production or a shared database.
 */
function testUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const parsed = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.replace("/", "").endsWith("_test")) {
    throw new Error("refusing to run integration tests: TEST_DATABASE_URL must be a localhost database named *_test");
  }
  return url;
}

export const realDb = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl() }) });

/**
 * Empties every application table, keeping the schema. The query-compiler client does not accept raw SQL, so the reset uses a
 * plain pg connection to the same database that testUrl() has already checked. Application code never uses this path.
 */
export async function resetDb(): Promise<void> {
  const pool = new pg.Pool({ connectionString: testUrl(), max: 1 });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    if (rows.length === 0) throw new Error("no tables found: have the migrations been applied to the test database?");
    const list = rows.map((r) => `"${r.tablename}"`).join(", ");
    await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
}
