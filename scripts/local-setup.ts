import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) { console.log("Existing .env preserved."); process.exit(0); }
const secret = () => randomBytes(32).toString("hex");
const pg = secret(), storage = secret();
writeFileSync(".env", [
  `DATABASE_URL=postgresql://store:${pg}@127.0.0.1:5432/store`,
  "BETTER_AUTH_URL=http://localhost:3000", `BETTER_AUTH_SECRET=${secret()}`, `REFERRAL_SECRET=${secret()}`, `JOB_SECRET=${secret()}`,
  "S3_ENDPOINT=http://127.0.0.1:9000", "S3_REGION=us-east-1", "S3_BUCKET=store-images",
  "S3_ACCESS_KEY_ID=S3RVER", "S3_SECRET_ACCESS_KEY=S3RVER", `POSTGRES_PASSWORD=${pg}`, "MINIO_ROOT_USER=localstore", `MINIO_ROOT_PASSWORD=${storage}`,
].join("\n") + "\n", { mode: 0o600, flag: "wx" });
console.log("Generated private local service configuration. No secrets printed.");
