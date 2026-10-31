import "dotenv/config";
import { z } from "zod";
import { db, transaction } from "../src/lib/db";
import { provisionAccount } from "../src/lib/accounts";
async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL);
  const password = z.string().min(12).max(128).parse(process.env.ADMIN_PASSWORD);
  if (await db.user.findUnique({ where: { email: email.toLowerCase() } })) throw new Error("Account exists; refusing to overwrite its credentials.");
  await transaction(tx => provisionAccount(tx, "Administrator", email, password, "ADMIN"));
  console.log("Admin created. Remove ADMIN_PASSWORD from your shell after use.");
}
main().finally(() => db.$disconnect());
