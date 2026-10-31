import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
import { codeSchema } from "./validation";
export const REFERRAL_COOKIE = "store-referral";
function secret() { if (!process.env.REFERRAL_SECRET) throw new Error("REFERRAL_SECRET is required"); return process.env.REFERRAL_SECRET; }
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
