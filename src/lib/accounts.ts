import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Tx } from "./db";
export async function provisionAccount(tx: Tx, name: string, email: string, password: string, role: "ADMIN" | "PARTNER") {
  const userId = randomUUID();
  await tx.user.create({ data: { id: userId, name, email: email.toLowerCase(), role, emailVerified: false,
    accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) } },
    ...(role === "ADMIN" ? { admin: { create: {} } } : {}),
  } });
  return userId;
}
