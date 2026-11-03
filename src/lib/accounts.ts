import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { Tx } from "./db";
export async function provisionAccount(tx: Tx, name: string, email: string, password: string, role: "ADMIN" | "PARTNER") {
  const userId = randomUUID();
  await tx.user.create({ data: { id: userId, name, email: email.toLowerCase(), role, emailVerified: false,
    accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) } },
    ...(role === "ADMIN" ? { admin: { create: {} } } : {}),
  } });
  return userId;
}

export class InitialAdminConfigError extends Error {}

// Trusted release scripts only; never expose this through a public HTTP endpoint.
export async function provisionFirstAdmin(tx: Tx, email: string | undefined, password: string | undefined): Promise<"created" | "exists" | "not-configured"> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(873194622)`;
  if (await tx.adminUser.count()) return "exists";
  if (!email && !password) return "not-configured";
  const credentials = z.object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    password: z.string().min(12).max(128),
  }).safeParse({ email, password });
  if (!credentials.success) throw new InitialAdminConfigError("Set both ADMIN_EMAIL (a valid email) and ADMIN_PASSWORD (12–128 characters) privately in the deployment settings. No administrator was created.");
  if (await tx.user.findUnique({ where: { email: credentials.data.email } })) {
    throw new InitialAdminConfigError("The selected email already belongs to an account. First-admin setup will not change its role or password. Use an unused email or recover the existing account through a trusted administrator.");
  }
  await provisionAccount(tx, "Administrator", credentials.data.email, credentials.data.password, "ADMIN");
  return "created";
}
