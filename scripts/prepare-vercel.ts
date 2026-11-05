import "dotenv/config";
import { spawnSync } from "node:child_process";
import { shouldPrepareDeploymentDatabase } from "../src/lib/deployment";

if (!shouldPrepareDeploymentDatabase(process.env)) {
  console.log("Database preparation skipped outside the Vercel production target or by SKIP_DEPLOY_DB_SETUP.");
  process.exit(0);
}

// The staging Vercel project also calls its primary/main deployment "production".
// Preview builds must not run migrations against a shared database automatically.
const connection = process.env.DATABASE_URL;
if (!connection || !/^postgres(?:ql)?:\/\//.test(connection)) {
  console.error("Deployment setup requires DATABASE_URL with a direct PostgreSQL connection string. No database changes were attempted.");
  process.exit(1);
}

for (const [script, args] of [
  ["scripts/migrate.ts", []],
  ["scripts/initialize.ts", ["--skip-storage"]],
  ["scripts/bootstrap-admin.ts", []],
  ["scripts/apply-catalog-presentation.ts", []],
] as const) {
  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...args], { env: process.env, stdio: "inherit" });
  if (result.error) {
    console.error("Could not start the deployment database preparation command.");
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Deployment preparation is ready. Existing accounts, inventory and financial history were preserved; owner catalog presentation is audited separately.");
