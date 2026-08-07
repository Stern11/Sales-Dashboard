import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.js (the real app build config) —
// keeps test tooling from ever influencing the production bundle. Tests
// live under test/, never under api/ — Vercel treats every file in api/ as
// a deployable route (vercel.json's functions glob is "api/**/*.js"), so a
// stray api/**/*.test.js would ship as a spurious serverless function.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
