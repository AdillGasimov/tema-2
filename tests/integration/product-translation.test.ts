import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
const requestContext = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => requestContext.headers }));
import { POST } from "../../src/app/api/admin/product-translate/route";
import { db, transaction } from "../../src/lib/db";
import { provisionAccount } from "../../src/lib/accounts";
import { auth } from "../../src/lib/auth";
import { appOrigin } from "../../src/lib/site";

const base = appOrigin(), run = randomUUID().slice(0, 8);
const input = { name: "Glass spray 50 ml", description: "Glass spray, volume 50 ml.", shortDescription: "" };
const az = { name: "Şüşə spreyi — 50 ml", description: "Şüşələr üçün sprey. Həcm: 50 ml.", shortDescription: "Şüşələr üçün sprey. Həcm: 50 ml." };
let adminCookie: string, partnerCookie: string, providerCalls = 0, addressIndex = 0;
const rateIds = new Set<string>();
function rateId(address: string, bucket: number) { return createHash("sha256").update(`product-translate:${address}:${bucket}`).digest("hex"); }
function testAddress() { return `2001:db8:${run.slice(0, 4)}::${++addressIndex}`; }
async function send(data: unknown, options: { cookie?: string; origin?: string; address?: string; contentType?: string } = {}) {
  const address = options.address ?? testAddress(), bucket = Math.floor(Date.now() / 60000);
  for (const n of [bucket, bucket + 1]) rateIds.add(rateId(address, n));
  const req = new NextRequest(`${base}/api/admin/product-translate`, { method: "POST", headers: {
    Origin: options.origin ?? base, "Content-Type": options.contentType ?? "application/json", "x-forwarded-for": address,
    ...(options.cookie === "" ? {} : { cookie: options.cookie ?? adminCookie }),
  }, body: JSON.stringify(data) });
  requestContext.headers = req.headers;
  return POST(req);
}
beforeAll(async () => {
  const password = randomUUID() + randomUUID();
  for (const role of ["ADMIN", "PARTNER"] as const) {
    const email = `translate-${role.toLowerCase()}-${run}@example.test`;
    await transaction(tx => provisionAccount(tx, `Translation ${role}`, email, password, role));
    const response = await auth.api.signInEmail({ body: { email, password }, headers: new Headers({ Origin: base }), asResponse: true });
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    expect(cookie).toContain("session_token");
    if (role === "ADMIN") adminCookie = cookie; else partnerCookie = cookie;
  }
});
beforeEach(() => {
  providerCalls = 0;
  vi.stubGlobal("fetch", async (url: string | URL) => {
    providerCalls++;
    // A real query must remain available while the provider is pending. The
    // external service is the only stub; session/role/rate/database are real.
    await db.product.count();
    const text = new URL(url).searchParams.get("q");
    const translatedText = text === input.name ? az.name : az.description;
    return Response.json({ responseData: { translatedText }, responseStatus: 200, quotaFinished: false });
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { id: { in: [...rateIds] } } });
  await db.$disconnect();
});

describe("protected product translation route", () => {
  it("rejects guests and partners before any provider work", async () => {
    expect((await send(input, { cookie: "" })).status).toBe(401);
    expect((await send(input, { cookie: partnerCookie })).status).toBe(403);
    expect(providerCalls).toBe(0);
  });
  it("requires trusted JSON origin and bounds the request body", async () => {
    expect((await send(input, { origin: "https://untrusted.example" })).status).toBe(403);
    expect((await send(input, { contentType: "text/plain" })).status).toBe(415);
    expect((await send({ ...input, description: "a".repeat(70000) })).status).toBe(413);
    expect((await send({ ...input, priceMinor: 1499 })).status).toBe(400);
    expect(providerCalls).toBe(0);
  });
  it("pauses on the free quota without touching product or inventory data", async () => {
    const before = [await db.product.count(), await db.inventoryMovement.count()];
    vi.stubGlobal("fetch", async () => { providerCalls++; return Response.json({ responseStatus: 403, quotaFinished: true, responseData: { translatedText: "DAILY LIMIT" } }); });
    const response = await send(input);
    expect(response.status).toBe(429); expect((await response.json()).error).toContain("günlük limiti");
    expect(providerCalls).toBe(1);
    expect([await db.product.count(), await db.inventoryMovement.count()]).toEqual(before);
  });
  it("translates only text outside inventory transactions and returns a noncached result", async () => {
    const before = [await db.product.count(), await db.inventoryMovement.count()];
    const response = await send(input);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(az); expect(providerCalls).toBe(2);
    expect([await db.product.count(), await db.inventoryMovement.count()]).toEqual(before);
  });
  it("enforces the persistent administrator request budget before an external translation call", async () => {
    const address = testAddress(), bucket = Math.floor(Date.now() / 60000);
    for (const n of [bucket, bucket + 1]) {
      const id = rateId(address, n); rateIds.add(id);
      await db.rateLimit.create({ data: { id, count: 60, expiresAt: new Date(Date.now() + 120000) } });
    }
    expect((await send(input, { address })).status).toBe(429);
    expect(providerCalls).toBe(0);
  });
});
