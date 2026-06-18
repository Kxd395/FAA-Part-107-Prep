import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@part107/core/quiz", replacement: path.resolve(__dirname, "../../packages/core/src/quiz.ts") },
      { find: "@part107/core/types", replacement: path.resolve(__dirname, "../../packages/core/src/types.ts") },
      { find: "@part107/core", replacement: path.resolve(__dirname, "../../packages/core/src/index.ts") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
