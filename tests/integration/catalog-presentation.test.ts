import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, transaction } from "../../src/lib/db";
import { applyCatalogPresentation, inspectCatalogPresentation, type CatalogPresentation } from "../../src/lib/catalog-presentation";
import { setProductCover } from "../../src/lib/product-image-order";
import { createOrder } from "../../src/lib/commerce";
import { catalog } from "../../src/lib/catalog";

const run = randomUUID().slice(0, 8);
const originalCategory = `presentation-source-${run}`, targetCategory = `presentation-target-${run}`;
const key = () => `images/${randomUUID()}.webp`;
let categoryId: string;
const products: { id: string; name: string; images: { key: string; id: string }[]; variantId: string }[] = [];
beforeAll(async () => {
  await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryFeeMinor: 0, freeDeliveryMinor: 0, sheetsEnabled: false } });
  categoryId = (await db.productCategory.create({ data: { name: `Source ${run}`, slug: originalCategory } })).id;
  for (let n = 0; n < 4; n++) {
    const p = await db.product.create({ data: { name: `Original presentation ${run}-${n}`, slug: `presentation-${run}-${n}`, categoryId, description: "Isolated catalog presentation fixture.", status: "PUBLISHED", variants: { create: { sku: `PRESENT-${run}-${n}`, priceMinor: 1500, costMinor: 500, stock: 8 } }, images: { create: Array.from({ length: n === 1 ? 12 : 2 }, (_, position) => ({ key: key(), alt: `Original presentation ${run}-${n}`, position })) } }, include: { images: { orderBy: { position: "asc" } }, variants: true } });
    products.push({ id: p.id, name: p.name, images: p.images, variantId: p.variants[0].id });
  }
});
afterAll(async () => {
  try { await db.product.updateMany({ where: { id: { in: products.map(p => p.id) }, status: { not: "DELETED" } }, data: { status: "ARCHIVED" } }); }
  finally { await db.$disconnect(); }
});
function plan(indices: number[], suffix: string, covers = false): CatalogPresentation {
  return { id: `presentation-${run}-${suffix}`, categories: [{ name: `Prepared ${run}`, slug: targetCategory }], items: indices.map(n => ({ id: products[n].id, expectedName: products[n].name, expectedCategoryId: categoryId, expectedImageKeys: products[n].images.map(i => i.key), name: `Hazır məhsul ${run}-${n}`, categorySlug: targetCategory, coverKey: products[n].images[0].key, ...(covers ? { coverAsset: { file: "test-cover.png", sha256: "a".repeat(64) } } : {}) })) };
}
describe("atomic and repeat-safe catalog presentation", () => {
  it("updates titles/categories/covers once and preserves order snapshots, money and stock", async () => {
    const p = plan([0, 1], "apply", true);
    const order = await createOrder({ idempotencyKey: randomUUID(), name: "Presentation test customer", phone: "+994500009999", city: "Bakı", address: "Test address", items: [{ variantId: products[0].variantId, quantity: 1 }] });
    const variantsBefore = await db.productVariant.findMany({ where: { productId: { in: p.items.map(i => i.id) } }, orderBy: { id: "asc" } });
    const movementCount = await db.inventoryMovement.count({ where: { variantId: { in: variantsBefore.map(v => v.id) } } });
    const uploaded = new Map(p.items.map(i => [i.id, key()]));
    expect(await inspectCatalogPresentation(p)).toBe("ready");
    const results = await Promise.all([applyCatalogPresentation(p, uploaded), applyCatalogPresentation(p, uploaded)]);
    expect(results.filter(r => r.applied)).toHaveLength(1);
    for (const item of p.items) {
      const updated = await db.product.findUniqueOrThrow({ where: { id: item.id }, include: { category: true, images: { orderBy: { position: "asc" } } } });
      expect(updated.name).toBe(item.name); expect(updated.category.slug).toBe(targetCategory); expect(updated.images[0].key).toBe(uploaded.get(item.id));
      expect(updated.images).toHaveLength(item.id === products[0].id ? 3 : 12);
      expect(updated.images.map(i => i.position)).toEqual(updated.images.map((_, i) => i));
    }
    expect(await db.productVariant.findMany({ where: { productId: { in: p.items.map(i => i.id) } }, orderBy: { id: "asc" } })).toEqual(variantsBefore);
    expect(await db.inventoryMovement.count({ where: { variantId: { in: variantsBefore.map(v => v.id) } } })).toBe(movementCount);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } })).items).toEqual(order.items);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "product.presentation", entityId: products[1].id } });
    expect(JSON.stringify(audit.detail)).toContain(products[1].images[0].key);
    await db.product.update({ where: { id: products[0].id }, data: { name: `Owner later edit ${run}` } });
    expect((await applyCatalogPresentation(p, uploaded)).applied).toBe(false);
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0].id } })).name).toBe(`Owner later edit ${run}`);
    await expect(applyCatalogPresentation({ ...p, items: p.items.map(i => ({ ...i, name: `${i.name} changed` })) }, uploaded)).rejects.toMatchObject({ status: 409 });
  });
  it("rejects conflicting current data before changing any product", async () => {
    const p = plan([2, 3], "conflict");
    await db.product.update({ where: { id: products[3].id }, data: { name: `Newer owner name ${run}` } });
    await expect(applyCatalogPresentation(p)).rejects.toMatchObject({ status: 409 });
    expect((await db.product.findUniqueOrThrow({ where: { id: products[2].id } })).name).toBe(products[2].name);
    expect(await db.auditLog.findUnique({ where: { id: `catalog-presentation:${p.id}` } })).toBeNull();
  });
  it("does not seed business products into other installations", async () => {
    const p = plan([2], "unmatched"); p.items[0].id = randomUUID();
    expect(await inspectCatalogPresentation(p)).toBe("unmatched");
    expect(await applyCatalogPresentation(p)).toMatchObject({ applied: false, reason: "unmatched", count: 0 });
  });
  it("selects only this product's existing cover and exposes the new order publicly", async () => {
    const p = products[2];
    await expect(transaction(tx => setProductCover(tx, p.id, products[3].images[0].key))).rejects.toThrow("Şəkil bu məhsula aid deyil.");
    await transaction(tx => setProductCover(tx, p.id, p.images[1].key));
    await transaction(tx => setProductCover(tx, p.id, p.images[1].key));
    const result = await catalog(new URLSearchParams({ q: p.name }));
    expect(result.products[0].images[0].key).toBe(p.images[1].key);
    expect(JSON.stringify(result.products)).not.toContain("costMinor");
    await db.product.update({ where: { id: p.id }, data: { status: "DELETED" } });
    await expect(transaction(tx => setProductCover(tx, p.id, p.images[0].key))).rejects.toThrow();
  });
});
