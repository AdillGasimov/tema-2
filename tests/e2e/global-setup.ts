import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { db, transaction } from "../../src/lib/db";
import { provisionAccount } from "../../src/lib/accounts";
import { adminMutation } from "../../src/lib/admin";
export default async function globalSetup() {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("E2E requires a dedicated test database.");
  const run = randomBytes(5).toString("hex"); const password = randomBytes(24).toString("base64url"); const email = `admin-${run}@example.test`;
  const actor = await transaction(tx => provisionAccount(tx, "Test Administrator", email, password, "ADMIN"));
  const other = await adminMutation("partners", { name: "Other Test Partner", phone: "+994500003333", email: `other-${run}@example.test`, password, category: "Test", code: `OTHER${run.toUpperCase()}` }, actor) as { id: string };
  const foreign = await adminMutation("partners", { name: "Code Login Test", phone: "+994500003334", email: "", password, category: "Test", code: `CODE${run.toUpperCase()}` }, actor) as { id: string };
  await db.storeSettings.update({ where: { id: "store" }, data: { domain: "http://localhost:3100", whatsapp: "+994500000000", deliveryFeeMinor: 0, freeDeliveryMinor: 0, sheetsEnabled: false } });
  await db.commissionRule.create({ data: { amountMinor: 200, holdDays: 0 } });
  mkdirSync(".local", { recursive: true }); writeFileSync(".local/e2e.json", JSON.stringify({ run, email, password, otherId: other.id, otherEmail: `other-${run}@example.test`, foreignId: foreign.id, foreignCode: `CODE${run.toUpperCase()}` }), { mode: 0o600 });
  await db.$disconnect();
}
