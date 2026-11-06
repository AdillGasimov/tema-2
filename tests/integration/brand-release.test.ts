import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { db } from "../../src/lib/db";
import { applyBrandRelease, inspectBrandRelease, type BrandRelease } from "../../src/lib/brand-release";
const run = randomUUID().slice(0, 8), marker = `test-brand-owner:${run}`;
let original: StoreSettings;
const newKey = () => `images/${randomUUID()}.webp`;
beforeAll(async () => {
  original = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  await db.auditLog.create({ data: { id: marker, actorId: "test:brand-release", action: "test.owner-marker", entity: "Test", entityId: run, detail: {} } });
});
afterEach(async () => { await db.storeSettings.update({ where: { id: "store" }, data: { brandName: original.brandName, domain: original.domain, logoKey: original.logoKey, faviconKey: original.faviconKey } }); });
afterAll(() => db.$disconnect());
function plan(suffix: string): BrandRelease {
  return { id: `test-brand-${run}-${suffix}`, ownerMarker: marker, expected: { brandName: original.brandName, domain: original.domain, logoKey: original.logoKey, faviconKey: original.faviconKey }, brandName: `FuryCar ${run}`, logo: { file: "logo.png", sha256: "a".repeat(64) }, favicon: { file: "favicon.png", sha256: "b".repeat(64) } };
}
describe("atomic, scoped owner branding", () => {
  it("updates only name/logo/favicon once and preserves subsequent owner edits", async () => {
    const p = plan("apply"), images = { logoKey: newKey(), faviconKey: newKey() };
    expect(await inspectBrandRelease(p)).toBe("ready");
    const results = await Promise.all([applyBrandRelease(p, images), applyBrandRelease(p, images)]);
    expect(results.filter(r => r.applied)).toHaveLength(1);
    const after = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
    expect(after).toMatchObject({ brandName: p.brandName, ...images, domain: original.domain });
    const changed = new Set(["brandName", "logoKey", "faviconKey", "updatedAt"]);
    expect(Object.fromEntries(Object.entries(after).filter(([k]) => !changed.has(k)))).toEqual(Object.fromEntries(Object.entries(original).filter(([k]) => !changed.has(k))));
    expect(await db.auditLog.count({ where: { id: `brand-release:${p.id}`, action: "settings.brand" } })).toBe(1);
    await db.storeSettings.update({ where: { id: "store" }, data: { brandName: "Owner later edit" } });
    expect((await applyBrandRelease(p, images)).applied).toBe(false);
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).brandName).toBe("Owner later edit");
    await expect(applyBrandRelease({ ...p, brandName: "Changed plan" }, images)).rejects.toMatchObject({ status: 409 });
  });
  it("does not rebrand other installations", async () => {
    const p = plan("unmatched"); p.ownerMarker = `absent:${run}`;
    expect(await inspectBrandRelease(p)).toBe("unmatched");
    expect(await applyBrandRelease(p, { logoKey: newKey(), faviconKey: newKey() })).toMatchObject({ applied: false, reason: "unmatched" });
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).brandName).toBe(original.brandName);
  });
  it("preserves newer logo/name/domain settings when they conflict", async () => {
    const p = plan("conflict"), newerLogo = newKey();
    await db.storeSettings.update({ where: { id: "store" }, data: { logoKey: newerLogo } });
    await expect(applyBrandRelease(p, { logoKey: newKey(), faviconKey: newKey() })).rejects.toMatchObject({ status: 409 });
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).logoKey).toBe(newerLogo);
    expect(await db.auditLog.findUnique({ where: { id: `brand-release:${p.id}` } })).toBeNull();
  });
});
