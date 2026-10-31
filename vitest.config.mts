import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ resolve: { alias: { "@": path.resolve("src") } }, test: { environment: "node", setupFiles: ["./tests/setup.ts"], testTimeout: 30000, hookTimeout: 30000 } });
