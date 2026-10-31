import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { db, transaction } from "../src/lib/db";
import { provisionAccount } from "../src/lib/accounts";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.endsWith("_test")) throw new Error("This helper is only for the local development store.");
  if (await db.adminUser.count()) { console.log("Existing administrator preserved. Use the documented account command for additional administrators."); return; }
  const email = "owner@localhost.invalid", password = randomBytes(24).toString("base64url");
  await transaction(tx => provisionAccount(tx, "Mağaza sahibi", email, password, "ADMIN"));
  mkdirSync(".local", { recursive: true });
  writeFileSync(".local/owner-credentials.json", JSON.stringify({ scope: "LOCAL DEVELOPMENT ONLY", email, password }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("Local administrator created. Credentials are in ignored .local/owner-credentials.json, not in logs.");
}
main().finally(() => db.$disconnect());
