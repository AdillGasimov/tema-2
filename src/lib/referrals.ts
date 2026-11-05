import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
import { codeSchema } from "./validation";
export const REFERRAL_COOKIE = "store-referral";
function secret() {
  const dedicated = process.env.REFERRAL_SECRET;
  if (dedicated?.trim()) return dedicated;
  const authSecret = process.env.BETTER_AUTH_SECRET;
  if (!authSecret || authSecret.trim().length < 32) throw new AppError("Referal linkini yadda saxlamaq alınmadı. Kodu sifariş zamanı daxil edə bilərsiniz.", 503);
  // Keep referral signatures separate from auth signatures without requiring
  // another deployment secret. Existing dedicated-key cookies stay compatible.
  return createHmac("sha256", authSecret).update("automotive-commerce/referral-cookie/v1").digest();
}
export function signReferral(code: string, expiresAt: number) {
  const payload = Buffer.from(JSON.stringify({ code, expiresAt })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function readReferral(value?: string, now = Date.now()): string | null {
  if (!value || value.length > 1000) return null;
  try {
    const [payload, sig] = value.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(sig, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!Number.isFinite(data.expiresAt) || data.expiresAt <= now) return null;
    return codeSchema.parse(data.code);
  } catch { return null; }
}
export async function activePartner(code: string) {
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) throw new AppError("Referal kodu düzgün deyil.");
  const partner = await db.partner.findUnique({ where: { code: parsed.data } });
  if (!partner || partner.status !== "ACTIVE") throw new AppError("Referal kodu tapılmadı və ya aktiv deyil.");
  return partner;
}
