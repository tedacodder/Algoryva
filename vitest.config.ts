import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Next compiles JSX with the automatic runtime; Vitest needs the same, or every component fails with "React is not defined".
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { exclude: ["node_modules/**", "tests/e2e/**", "mobile/**"] }, // Playwright specs are run by `npm run test:e2e`, not Vitest
});
