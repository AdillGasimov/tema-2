import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { db } from "./db";
import { AppError } from "./errors";
import { appOrigin, trustedOrigins } from "./site";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL: appOrigin(),
  trustedOrigins: trustedOrigins(),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24, updateAge: 60 * 60, cookieCache: { enabled: false } },
  user: { additionalFields: { role: { type: "string", defaultValue: "PARTNER", input: false } } },
  rateLimit: { enabled: true, window: 60, max: 10 },
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" && appOrigin().startsWith("https:") },
});
export async function session() { return auth.api.getSession({ headers: await headers() }); }
export async function requireUser(role?: "ADMIN" | "PARTNER") {
  const s = await session();
  if (!s) throw new AppError("Daxil olmağınız tələb olunur.", 401);
  if (role && s.user.role !== role) throw new AppError("Bu əməliyyata icazəniz yoxdur.", 403);
  if (s.user.role === "ADMIN") {
    if (!await db.adminUser.findUnique({ where: { userId: s.user.id } })) throw new AppError("İcazə yoxdur.", 403);
  }
  if (s.user.role === "PARTNER") {
    const p = await db.partner.findUnique({ where: { userId: s.user.id } });
    if (!p || p.status !== "ACTIVE") throw new AppError("Tərəfdaş hesabı aktiv deyil.", 403);
  }
  return s.user;
}
export async function requirePartner() {
  const user = await requireUser("PARTNER");
  const partner = await db.partner.findUniqueOrThrow({ where: { userId: user.id } });
  return { user, partner };
}
