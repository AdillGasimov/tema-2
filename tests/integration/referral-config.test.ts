import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/lib/db";
import { REFERRAL_COOKIE, signReferral } from "../../src/lib/referrals";
import { GET, POST } from "../../src/app/api/referrals/route";

const cookieValues = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined }) }));
const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
const code = `R${suffix}`;
const origin = "https://shop.example.test";
let partnerId: string, userId: string;
function request() {
  return new NextRequest(`${origin}/api/referrals`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": `referral-test-${suffix}` }, body: JSON.stringify({ code }) });
}
beforeAll(async () => {
  userId = (await db.user.create({ data: { id: randomUUID(), name: "Referral config test", email: `referral-${suffix}@example.test`, role: "PARTNER" } })).id;
  partnerId = (await db.partner.create({ data: { userId, name: "Referral config test", phone: "+994500007777", category: "Test", code, status: "ACTIVE" } })).id;
});
beforeEach(() => { cookieValues.clear(); vi.stubEnv("BETTER_AUTH_URL", origin); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  if (partnerId) { await db.referralVisit.deleteMany({ where: { partnerId } }); await db.partner.delete({ where: { id: partnerId } }); }
  if (userId) await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("referral capture configuration with real PostgreSQL", () => {
  it("captures a secure auth-derived cookie, reads it back and avoids repeat visits", async () => {
    vi.stubEnv("REFERRAL_SECRET", undefined);
    const before = await db.referralVisit.count({ where: { partnerId } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/;\s*HttpOnly/i); expect(cookie).toMatch(/;\s*Secure/i); expect(cookie).toMatch(/;\s*SameSite=lax/i); expect(cookie).toMatch(/;\s*Path=\//i); expect(cookie).toMatch(/;\s*Max-Age=[1-9]\d*/i);
    const token = /^store-referral=([^;]+)/.exec(cookie)?.[1];
    expect(token).toBeTruthy(); cookieValues.set(REFERRAL_COOKIE, token!);
    expect(await (await GET()).json()).toEqual({ code });
    expect((await POST(request())).status).toBe(200);
    expect(await db.referralVisit.count({ where: { partnerId } })).toBe(before + 1);
  });

  it("retains existing dedicated-key cookies after an auth-key rotation", async () => {
    cookieValues.set(REFERRAL_COOKIE, signReferral(code, Date.now() + 60000));
    vi.stubEnv("BETTER_AUTH_SECRET", "rotated-auth-key-for-test-12345678901234567890");
    const before = await db.referralVisit.count({ where: { partnerId } });
    expect((await POST(request())).status).toBe(200);
    expect(await (await GET()).json()).toEqual({ code });
    expect(await db.referralVisit.count({ where: { partnerId } })).toBe(before);
  });

  it("does not record a visit when no secure cookie can be issued", async () => {
    vi.stubEnv("REFERRAL_SECRET", undefined); vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    const before = await db.referralVisit.count({ where: { partnerId } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await db.referralVisit.count({ where: { partnerId } })).toBe(before);
  });
});
