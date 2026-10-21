import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Real-model evaluations cost money; they only run via `npm run eval:ai`.
    exclude: process.argv.some((arg) => arg.includes("tests/eval")) ? [] : ["tests/eval/**"],
    setupFiles: ["tests/helpers/setup.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    // Integration tests share one Postgres database.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
