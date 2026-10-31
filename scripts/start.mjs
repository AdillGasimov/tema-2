import "dotenv/config";
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
if (!existsSync(".next/standalone/server.js")) throw new Error("Run npm run build before starting the production server.");
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], { env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: process.env.PORT ?? "3000" }, stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
