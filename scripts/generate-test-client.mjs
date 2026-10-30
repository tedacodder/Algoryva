// Generates a Prisma client for integration tests only. It reads the production schema, swaps only the generator block for one
// that uses the engine-less query compiler and a Postgres driver adapter, and writes it under prisma/.generated (git-ignored).
// The production schema and the production client are not changed.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const source = readFileSync("prisma/schema.prisma", "utf8");
const generator = `generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["queryCompiler", "driverAdapters"]
  engineType      = "client"
  output          = "./client"
}`;
const replaced = source.replace(/generator client \{[^}]*\}/, generator);
if (replaced === source) throw new Error("generator block not found in prisma/schema.prisma");
mkdirSync("prisma/.generated", { recursive: true });
writeFileSync("prisma/.generated/test.prisma", replaced);
execFileSync("npx", ["prisma", "generate", "--schema", "prisma/.generated/test.prisma"], {
  stdio: "inherit",
  env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1", PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1" },
});
