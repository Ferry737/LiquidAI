// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "test/**/*.test.ts",
      "server/test/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "shared/**/*.ts", "server/src/**/*.ts"],
    },
  },
});
