import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests run against a real disposable PostgreSQL. They share one database, so they run one file at a time.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
