import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The env module validates these on import.
    env: {
      PORT: "0",
      REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      CLIENT_URL: "http://localhost:5173",
      NODE_ENV: "test",
      MATCH_WIDEN_MS: "800",
    },
  },
});
