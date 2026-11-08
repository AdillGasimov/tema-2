import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { db } from "../../src/lib/db";
import { adminMutation } from "../../src/lib/admin";
import { applyStorefrontAvailability, inspectStorefrontAvailability, type StorefrontAvailabilityPlan } from "../../src/lib/storefront-availability-release";
const run = randomUUID().slice(0, 8), actor = `availability-test:${run}`, marker = `${actor}:owner`;
const shipping = { announcement: "", deliveryFreeRegions: "28 May (Bakı)", deliveryFeeMinor: 500 };
let original: StoreSettings, categoryId: string;
const products: string[] = [];
beforeAll(async () => {
  original = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  categoryId = (await db.productCategory.create({ data: { name: `Availability ${run}`, slug: `availability-${run}` } })).id;
  await db.auditLog.create({ data: { id: marker, actorId: actor, action: "test.owner", entity: "Test", entityId: run, detail: {} } });
  await db.storeSettings.update({ where: { id: "store" }, data: shipping });
});
afterEach(() => db.storeSettings.update({ where: { id: "store" }, data: shipping }));
afterAll(async () => {
  await db.product.updateMany({ where: { id: { in: products } }, data: { status: "ARCHIVED" } });
  await db.storeSettings.update({ where: { id: "store" }, data: original });
  await db.$disconnect();
});
async function product(label: string) {
  const result = await adminMutation("products", { name: `Availability ${label}`, slug: `availability-${run}-${label}`, description: "Test", categoryId, status: "PUBLISHED", featured: false,
    variants: [{ name: "Standart", sku: `AV-${run}-${label}`, priceMinor: 1999, costMinor: 500, stock: 5 }] }, actor) as { id: string };
  products.push(result.id);
  return db.product.findUniqueOrThrow({ where: { id: result.id }, include: { variants: true } });
}
type Product = Awaited<ReturnType<typeof product>>;
function plan(ps: Product[], label: string): StorefrontAvailabilityPlan {
  return { id: `availability-${run}-${label}`, ownerMarker: marker, ownerConfirmedAtLeastOne: true, settings: shipping,
    variants: ps.flatMap(p => p.variants.map(v => ({ id: v.id, productId: p.id, storeSku: v.storeSku! }))) };
}
describe("owner-confirmed storefront stock and delivery", () => {
  it("verifies once under concurrent retries without changing counts, prices or inventory history; later owner edits survive replay", async () => {
    const a = await product("first"), b = await product("second"), p = plan([a, b], "apply");
    const ids = p.variants.map(v => v.id);
    const snapshot = () => db.productVariant.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" }, select: { id: true, stock: true, reserved: true, priceMinor: true, discountMinor: true, costMinor: true, sku: true, storeSku: true } });
    const before = await snapshot(), movements = await db.inventoryMovement.count({ where: { variantId: { in: ids } } });
    expect(await inspectStorefrontAvailability(p)).toBe("ready");
    const results = await Promise.all([applyStorefrontAvailability(p), applyStorefrontAvailability(p)]);
    expect(results.filter(r => r.applied)).toHaveLength(1); expect(await snapshot()).toEqual(before);
    expect(await db.productVariant.count({ where: { id: { in: ids }, stockVerified: true } })).toBe(2);
    expect(await db.inventoryMovement.count({ where: { variantId: { in: ids } } })).toBe(movements);
    expect(await db.auditLog.count({ where: { actorId: "system:owner-stock-confirmation", action: "inventory.adjust", entityId: { in: ids } } })).toBe(2);
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).announcement).toBe("28 May (Bakı) üçün çatdırılma ödənişsizdir.");
    await db.productVariant.update({ where: { id: ids[0] }, data: { stockVerified: false, stock: 0 } });
    await db.storeSettings.update({ where: { id: "store" }, data: { announcement: "Sonrakı sahib qeydi" } });
    expect((await applyStorefrontAvailability(p)).applied).toBe(false);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: ids[0] } })).stockVerified).toBe(false);
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).announcement).toBe("Sonrakı sahib qeydi");
    await expect(applyStorefrontAvailability({ ...p, settings: { ...shipping, deliveryFeeMinor: 0 } })).rejects.toThrow("cannot be changed");
  });
  it("skips other installations and requires explicit owner confirmation", async () => {
    const a = await product("unmatched"), p = plan([a], "unmatched");
    expect((await applyStorefrontAvailability({ ...p, ownerMarker: "missing-owner-marker" })).reason).toBe("unmatched");
    await expect(applyStorefrontAvailability({ ...p, ownerConfirmedAtLeastOne: false })).rejects.toThrow();
    await expect(applyStorefrontAvailability({ ...p, variants: [...p.variants, ...p.variants] })).rejects.toThrow("Duplicate variant");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } })).stockVerified).toBe(false);
  });
  it.each(["empty", "reserved", "draft", "inactive"])("rolls back the whole confirmation when a %s item is no longer available", async state => {
    const a = await product(`good-${state}`), b = await product(`bad-${state}`), p = plan([a, b], state);
    if (state === "empty") await db.productVariant.update({ where: { id: b.variants[0].id }, data: { stock: 0 } });
    if (state === "reserved") await db.productVariant.update({ where: { id: b.variants[0].id }, data: { reserved: 5 } });
    if (state === "inactive") await db.productVariant.update({ where: { id: b.variants[0].id }, data: { active: false } });
    if (state === "draft") await db.product.update({ where: { id: b.id }, data: { status: "DRAFT" } });
    await expect(applyStorefrontAvailability(p)).rejects.toThrow();
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } })).stockVerified).toBe(false);
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).announcement).toBe("");
    expect(await db.auditLog.findUnique({ where: { id: `storefront-availability:${p.id}` } })).toBeNull();
  });
  it("preserves newer delivery settings by aborting before any verification", async () => {
    const a = await product("settings"), p = plan([a], "settings");
    await db.storeSettings.update({ where: { id: "store" }, data: { deliveryFeeMinor: 700 } });
    await expect(applyStorefrontAvailability(p)).rejects.toThrow("Delivery settings changed");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } })).stockVerified).toBe(false);
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).deliveryFeeMinor).toBe(700);
  });
});
