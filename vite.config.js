import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev always runs through `vercel dev` (see README), which spawns this
// Vite server internally and proxies /api/* to the serverless functions in
// api/ itself — so no dev-server proxy config is needed here.
export default defineConfig({
  plugins: [react()],
});
