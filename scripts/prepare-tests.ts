import "dotenv/config";
import { Client } from "pg";
import { config } from "dotenv";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("This helper only provisions a local disposable test database. Configure remote test environments separately.");
  const client = new Client({ connectionString: url.toString() }); await client.connect();
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["store_test"])).rowCount) await client.query('CREATE DATABASE "store_test"');
  await client.end(); url.pathname = "/store_test";
  if (!existsSync(".env.test")) writeFileSync(".env.test", [
    `DATABASE_URL=${url}`, "BETTER_AUTH_URL=http://localhost:3100", `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`,
    `REFERRAL_SECRET=${randomBytes(32).toString("hex")}`, `JOB_SECRET=${randomBytes(32).toString("hex")}`,
    ...["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].map(k => `${k}=${process.env[k] ?? ""}`),
  ].join("\n") + "\n", { mode: 0o600, flag: "wx" });
  config({ path: ".env.test", override: true, quiet: true });
  for (const script of ["scripts/migrate.ts", "scripts/initialize.ts"]) { const result = spawnSync(process.execPath, ["--import", "tsx", script], { env: process.env, stdio: "inherit" }); if (result.status !== 0) process.exit(result.status ?? 1); }
  console.log("Dedicated test database prepared without resetting any database.");
}
main();
