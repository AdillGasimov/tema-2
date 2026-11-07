import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { db } from "../../src/lib/db";
import { adminMutation } from "../../src/lib/admin";
import { createOrder } from "../../src/lib/commerce";
import { catalog } from "../../src/lib/catalog";
import { importProducts, previewPhotoImport } from "../../src/lib/product-import";
import { applyCatalogReview, inspectCatalogReview, type CatalogReviewPlan } from "../../src/lib/catalog-review-release";

const run = randomUUID().slice(0, 8), actor = `review-test:${run}`, marker = `${actor}:owner`;
let settings: StoreSettings, categoryId: string;
const created: string[] = [];
beforeAll(async () => {
  settings = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  categoryId = (await db.productCategory.create({ data: { name: `Review ${run}`, slug: `review-${run}` } })).id;
  await db.auditLog.create({ data: { id: marker, actorId: actor, action: "test.owner", entity: "Test", entityId: run, detail: {} } });
  await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryRegions: "Bakı" } });
});
afterEach(() => db.storeSettings.update({ where: { id: "store" }, data: { deliveryInfo: settings.deliveryInfo } }));
afterAll(async () => { await db.product.updateMany({ where: { id: { in: created } }, data: { status: "ARCHIVED" } }); await db.storeSettings.update({ where: { id: "store" }, data: settings }); await db.$disconnect(); });
async function product(label: string, priceMinor = 1500) {
  const result = await adminMutation("products", { name: `Məhsul ${label}`, slug: `review-${run}-${label}`, description: "Test məhsulu", categoryId, status: "PUBLISHED", featured: false,
    variants: [{ name: "Standart", sku: `TM-${run}-${label}`, costMinor: 500, priceMinor, stock: 5 }] }, actor) as { id: string };
  created.push(result.id);
  return db.product.findUniqueOrThrow({ where: { id: result.id }, include: { variants: true } });
}
type Product = Awaited<ReturnType<typeof product>>;
const input = (p: Product) => ({ id: p.id, name: p.name, slug: p.slug, description: p.description, categoryId, featured: false, status: p.status as "DRAFT" | "PUBLISHED", variants: p.variants.map(v => ({ id: v.id, name: v.name, sku: v.sku, costMinor: v.costMinor, priceMinor: v.priceMinor, stock: v.stock })) });
function plan(a: Product, b: Product, suffix: string): CatalogReviewPlan {
  return { id: `review-${run}-${suffix}`, ownerMarker: marker, variants: [a, b].map(p => ({ id: p.variants[0].id, productId: p.id, sourceSku: p.variants[0].sku })), price: { productId: a.id, variantId: a.variants[0].id, expectedMinor: 10000, minor: 1999 }, delivery: { expectedInfo: settings.deliveryInfo, info: "" }, rights: [{ id: b.id, slug: b.slug, imageKeys: [] }] };
}
describe("store SKU, verification and reviewed corrections", () => {
  it("allocates unique FC codes concurrently, keeps source CSV matching private and snapshots the owned SKU on orders", async () => {
    const [a, b] = await Promise.all([product("sku-a"), product("sku-b")]);
    expect(a.variants[0].storeSku).toMatch(/^FC-\d{4,}$/); expect(b.variants[0].storeSku).not.toBe(a.variants[0].storeSku);
    const publicProduct = (await catalog(new URLSearchParams({ q: a.name, category: `review-${run}` }))).products.find(p => p.id === a.id)!;
    expect(publicProduct.variants[0]).not.toHaveProperty("sku"); expect(publicProduct.variants[0].storeSku).toBe(a.variants[0].storeSku); expect(publicProduct.variants[0].stockVerified).toBe(false);
    const photo = await previewPhotoImport(`sku,image_urls\n${a.variants[0].sku},https://img.kwcdn.com/product/fancy/a.jpg`);
    expect(photo.issues).toEqual([]); expect(photo.photos[0].sku).toBe(a.variants[0].sku);
    const order = await createOrder({ idempotencyKey: randomUUID(), name: "Review test", phone: "+994500001182", city: "Bakı", address: "Test ünvanı", items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    expect(order.items[0].sku).toBe(a.variants[0].storeSku);
    const csv = `name,sku,price,cost,stock,slug\nCSV test,TM-CSV-${run},15,5,100,csv-review-${run}`;
    await importProducts(csv, categoryId, randomUUID(), actor);
    const imported = await db.productVariant.findUniqueOrThrow({ where: { sku: `TM-CSV-${run}` } }); created.push(imported.productId);
    expect(imported.storeSku).toMatch(/^FC-\d{4,}$/); expect(imported.stockVerified).toBe(false);
  });
  it("verifies physical counts without inventing a stock movement, and invalidates an unconfirmed adjustment", async () => {
    const p = await product("stock"), v = p.variants[0], before = await db.inventoryMovement.count({ where: { variantId: v.id } });
    await adminMutation("inventory", { variantId: v.id, delta: 0, stockVerified: true, reason: "Anbarda fiziki sayım aparıldı" }, actor);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({ stock: 5, stockVerified: true });
    expect(await db.inventoryMovement.count({ where: { variantId: v.id } })).toBe(before);
    await adminMutation("inventory", { variantId: v.id, delta: 1, reason: "Yoxlanılmamış say düzəlişi" }, actor);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).toMatchObject({ stock: 6, stockVerified: false });
  });
  it("applies the correction once, preserves historical order prices and inventory, and blocks held products until documented clearance", async () => {
    const a = await product("price", 10000), b = await product("rights");
    const order = await createOrder({ idempotencyKey: randomUUID(), name: "History test", phone: "+994500001183", city: "Bakı", address: "Test ünvanı", items: [{ variantId: a.variants[0].id, quantity: 1 }] });
    await db.productVariant.updateMany({ where: { id: { in: [a.variants[0].id, b.variants[0].id] } }, data: { storeSku: null } });
    const before = await db.productVariant.findMany({ where: { productId: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
    const p = plan(a, b, "apply"); expect(await inspectCatalogReview(p)).toBe("ready");
    const results = await Promise.all([applyCatalogReview(p), applyCatalogReview(p)]); expect(results.filter(v => v.applied)).toHaveLength(1);
    const current = await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } }); expect(current.priceMinor).toBe(1999);
    const after = await db.productVariant.findMany({ where: { productId: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
    expect(after.map(v => [v.id, v.stock, v.reserved, v.costMinor, v.sku])).toEqual(before.map(v => [v.id, v.stock, v.reserved, v.costMinor, v.sku]));
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } })).items).toEqual(order.items);
    expect((await catalog(new URLSearchParams({ q: b.name, category: `review-${run}` }))).products).toHaveLength(0);
    await expect(adminMutation("product-bulk", { ids: [b.id], status: "PUBLISHED" }, actor)).rejects.toThrow("hüquq yoxlaması");
    await expect(adminMutation("products", { ...input(b), rightsReviewRequired: false, rightsClearance: "", status: "PUBLISHED" }, actor)).rejects.toThrow("sənəd istinadını");
    await expect(createOrder({ idempotencyKey: randomUUID(), name: "Blocked test", phone: "+994500001184", city: "Bakı", address: "Test ünvanı", items: [{ variantId: b.variants[0].id, quantity: 1 }] })).rejects.toThrow("satışda deyil");
    await adminMutation("products", { ...input(b), rightsReviewRequired: false, rightsClearance: "Sınaq sənədi 123, tarix 2026-11-07; yalnız test qeydi", status: "PUBLISHED" }, actor);
    await db.productVariant.update({ where: { id: a.variants[0].id }, data: { priceMinor: 2499 } });
    expect((await applyCatalogReview(p)).reason).toBe("applied");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } })).priceMinor).toBe(2499);
    expect((await db.product.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PUBLISHED");
    await expect(applyCatalogReview({ ...p, price: { ...p.price, minor: 999 } })).rejects.toThrow("cannot be changed");
  });
  it("skips other stores and rolls back every correction if owner fields changed", async () => {
    const a = await product("conflict-price", 10000), b = await product("conflict-rights"), p = plan(a, b, "conflict");
    expect((await applyCatalogReview({ ...p, ownerMarker: `unmatched-${run}` })).reason).toBe("unmatched");
    await db.storeSettings.update({ where: { id: "store" }, data: { deliveryInfo: "Daha yeni sahib qeydi" } });
    await expect(applyCatalogReview(p)).rejects.toThrow("Delivery note changed");
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: a.variants[0].id } })).priceMinor).toBe(10000);
    expect((await db.product.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PUBLISHED");
    expect(await db.auditLog.findUnique({ where: { id: `catalog-review:${p.id}` } })).toBeNull();
  });
});
