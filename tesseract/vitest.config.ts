import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      SESSION_SECRET:
        "dGVzc2VyYS10ZXN0LXNlY3JldC1kby1ub3QtdXNlLWluLXByb2R1Y3Rpb24tMzI=",
    },
  },
});
