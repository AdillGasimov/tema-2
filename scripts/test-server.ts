import { config } from "dotenv";
import { spawn } from "node:child_process";
config({ path: ".env.test", override: true, quiet: true });
if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("Refusing to run browser tests against a business database.");
const child = spawn(process.execPath, ["scripts/start.mjs"], { env: { ...process.env, PORT: "3100" }, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
