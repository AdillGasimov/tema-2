import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { db } from "../../src/lib/db";
import { adminMutation } from "../../src/lib/admin";
import { createOrder, whatsappMessage } from "../../src/lib/commerce";
import { applyStoreContent, type StoreContentPlan } from "../../src/lib/store-content-release";
import { catalog } from "../../src/lib/catalog";
import { previewProductImport } from "../../src/lib/product-import";
const run = randomUUID().slice(0, 8), actor = `test:audit:${run}`, marker = `${actor}:owner`;
let original: StoreSettings, categoryId: string;
const created: string[] = [];
beforeAll(async () => {
  original = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  const c = await db.productCategory.create({ data: { name: `Audit ${run}`, slug: `audit-${run}` } }); categoryId = c.id;
  await db.auditLog.create({ data: { id: marker, actorId: actor, action: "test.owner", entity: "Test", entityId: run, detail: {} } });
});
afterEach(() => db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: original.whatsapp, deliveryInfo: original.deliveryInfo, deliveryRegions: original.deliveryRegions, deliveryTime: original.deliveryTime, deliveryFreeRegions: original.deliveryFreeRegions, deliveryFeeMinor: original.deliveryFeeMinor, freeDeliveryMinor: original.freeDeliveryMinor } }));
afterAll(async () => { await db.product.updateMany({ where: { id: { in: created } }, data: { status: "ARCHIVED" } }); await db.$disconnect(); });
async function makeProduct(label: string, price = 1500, category = categoryId) {
  const p = await adminMutation("products", { name: `Sınaq ${label}`, slug: `audit-${run}-${label}`, description: "İlkin təsvir", categoryId: category, status: "PUBLISHED", featured: false,
    variants: [{ name: "Standart", sku: `AUDIT-${run}-${label}`, costMinor: 100, priceMinor: price, stock: 10 }] }, actor) as { id: string };
  created.push(p.id); return db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: true } });
}
type TestProduct = Awaited<ReturnType<typeof makeProduct>>;
function input(p: TestProduct, slug: string) { return { id: p.id, name: p.name, slug, description: p.description, shortDescription: p.shortDescription, categoryId: p.categoryId, status: "PUBLISHED", featured: p.featured,
  variants: p.variants.map(v => ({ id: v.id, name: v.name, sku: v.sku, costMinor: v.costMinor, priceMinor: v.priceMinor, stock: v.stock, discountMinor: v.discountMinor, commissionMinor: v.commissionMinor, active: v.active, lowStock: v.lowStock })) }; }
function plan(products: TestProduct[], suffix: string): StoreContentPlan {
  const fields = ["name", "slug", "description", "shortDescription", "seoTitle", "seoDescription"] as const;
  const delivery = { deliveryInfo: original.deliveryInfo, deliveryRegions: original.deliveryRegions, deliveryTime: original.deliveryTime, deliveryFreeRegions: original.deliveryFreeRegions, deliveryFeeMinor: original.deliveryFeeMinor, freeDeliveryMinor: original.freeDeliveryMinor };
  return { id: `test-audit-${run}-${suffix}`, ownerMarker: marker, products: products.map((p, i) => ({ id: p.id,
    expected: Object.fromEntries(fields.map(k => [k, p[k]])) as StoreContentPlan["products"][number]["expected"],
    after: { name: `Ətirləndirici ${suffix} ${i}`, slug: `yeni-${p.slug}`, description: "Azərbaycan dilində tam təsvir.", shortDescription: "Qısa Azərbaycan təsviri.", seoTitle: `Ətirləndirici ${suffix} ${i}`, seoDescription: `Məhsul ${suffix} ${i} haqqında qısa məlumat.` }, images: [],
    ...(i === 1 ? { priceReview: { sku: p.variants[0].sku, expectedMinor: 10000 } } : {}),
  })), delivery: { expected: delivery, after: { ...delivery, deliveryRegions: "28 May (Bakı), Bakı, Digər bölgələr", deliveryFeeMinor: 500, freeDeliveryMinor: 0, deliveryFreeRegions: "28 May (Bakı)", deliveryTime: "3 iş günü; rayonlara 4 iş günü", deliveryInfo: "WhatsApp vasitəsilə təsdiqlənir." } } };
}
describe("retained product URLs", () => {
  it("serializes renaming against URL reuse, keeps history and blocks CSV reuse", async () => {
    const p = await makeProduct("old-url"); const next = `${p.slug}-new`;
    const beforeMovements = await db.inventoryMovement.count({ where: { variantId: p.variants[0].id } });
    const results = await Promise.allSettled([
      adminMutation("products", input(p, next), actor),
      adminMutation("products", { ...input(p, p.slug), id: undefined, name: "Başqa məhsul", variants: [{ name: "Standart", sku: `OTHER-${run}`, costMinor: 100, priceMinor: 1500, stock: 1 }] }, actor),
    ]);
    expect(results[0].status).toBe("fulfilled"); expect(results[1].status).toBe("rejected");
    expect(await db.productSlugAlias.findUnique({ where: { oldSlug: p.slug } })).toMatchObject({ productId: p.id });
    const updated = await db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: true } });
    await adminMutation("products", input(updated, `${next}-again`), actor);
    expect(await db.productSlugAlias.count({ where: { productId: p.id } })).toBe(2);
    expect(await db.inventoryMovement.count({ where: { variantId: p.variants[0].id } })).toBe(beforeMovements);
    const csv = `name,sku,price,cost,stock,slug\nYeni məhsul,NEW-${run},15,1,1,${p.slug}`;
    expect((await previewProductImport(csv, categoryId)).issues.some(i => i.message.includes("əvvəlki məhsul ünvanı"))).toBe(true);
    const canonical = await db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: true } });
    await adminMutation("products", input(canonical, p.slug), actor);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).slug).toBe(p.slug);
  });
});
describe("audited store content release", () => {
  it("applies concurrent retries once without editing variant/financial data and preserves later changes", async () => {
    const a = await makeProduct("content-a"), b = await makeProduct("content-b", 10000); const p = plan([a, b], "apply");
    const variants = await db.productVariant.findMany({ where: { productId: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
    const orders = await db.order.count();
    const results = await Promise.all([applyStoreContent(p), applyStoreContent(p)]); expect(results.filter(r => r.applied)).toHaveLength(1);
    expect(await db.productVariant.findMany({ where: { productId: { in: [a.id, b.id] } }, orderBy: { id: "asc" } })).toEqual(variants);
    expect(await db.order.count()).toBe(orders);
    expect(await db.product.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ needsPriceReview: true, shortDescription: p.products[1].after.shortDescription });
    expect(await db.productSlugAlias.findUnique({ where: { oldSlug: a.slug } })).toMatchObject({ productId: a.id });
    expect(await db.auditLog.count({ where: { id: `store-content:${p.id}` } })).toBe(1);
    await db.product.update({ where: { id: a.id }, data: { description: "Owner later edit" } }); await db.storeSettings.update({ where: { id: "store" }, data: { deliveryFeeMinor: 600 } });
    expect((await applyStoreContent(p)).reason).toBe("applied");
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).description).toBe("Owner later edit");
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).deliveryFeeMinor).toBe(600);
    await expect(applyStoreContent({ ...p, delivery: { ...p.delivery, after: { ...p.delivery.after, deliveryFeeMinor: 700 } } })).rejects.toMatchObject({ status: 409 });
  });
  it("skips another installation and atomically refuses changed metadata or a conflicting destination", async () => {
    const a = await makeProduct("conflict-a"), b = await makeProduct("conflict-b"); const p = plan([a, b], "conflict");
    expect((await applyStoreContent({ ...p, ownerMarker: `absent:${run}` })).reason).toBe("unmatched");
    await db.product.update({ where: { id: b.id }, data: { description: "Newer owner description" } });
    await expect(applyStoreContent(p)).rejects.toMatchObject({ status: 409 });
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).slug).toBe(a.slug);
    expect(await db.productSlugAlias.findUnique({ where: { oldSlug: a.slug } })).toBeNull();
    await db.product.update({ where: { id: b.id }, data: { description: b.description } });
    const occupied = await makeProduct("occupied");
    await expect(applyStoreContent({ ...p, products: p.products.map((x, i) => i ? x : { ...x, after: { ...x.after, slug: occupied.slug } }) })).rejects.toMatchObject({ status: 409 });
    expect(await db.auditLog.findUnique({ where: { id: `store-content:${p.id}` } })).toBeNull();
  });
});
describe("new-order delivery snapshots", () => {
  it("calculates free 28 May and paid other addresses on the server, preserving previous orders on policy changes", async () => {
    await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryRegions: "28 May (Bakı), Bakı, Digər bölgələr", deliveryFreeRegions: "28 May (Bakı)", deliveryFeeMinor: 500, freeDeliveryMinor: 0 } });
    const p = await makeProduct("shipping");
    const request = (city: string) => ({ idempotencyKey: randomUUID(), name: "Test çatdırılma müştərisi", phone: "+994500008877", city, address: "Sınaq ünvanı 12", items: [{ variantId: p.variants[0].id, quantity: 1 }] });
    const free = await createOrder(request("28 May (Bakı)")); const input = request("Bakı"); const paid = await createOrder(input); const district = await createOrder(request("Digər bölgələr"));
    expect(free.deliveryChargedMinor).toBe(0); expect(paid.deliveryChargedMinor).toBe(500); expect(district.deliveryChargedMinor).toBe(500);
    expect(paid.totalMinor).toBe(2000); expect(whatsappMessage(paid)).toMatch(/Çatdırılma: 5[.,]00/);
    await db.storeSettings.update({ where: { id: "store" }, data: { deliveryFeeMinor: 700 } });
    expect((await createOrder(input)).deliveryChargedMinor).toBe(500);
    expect((await db.order.findUniqueOrThrow({ where: { id: paid.id } })).totalMinor).toBe(2000);
  });
});
describe("catalog filters and pagination", () => {
  it("uses matching variant prices, stable pages, safe page numbers and Azerbaijani name ordering", async () => {
    const c = await db.productCategory.create({ data: { name: `Filtr ${run}`, slug: `filter-${run}` } });
    for (let n = 0; n < 14; n++) await makeProduct(`filter-${n}`, 1000 + n * 100, c.id);
    const multi = await makeProduct("filter-multi", 1000, c.id);
    await adminMutation("products", { ...input(multi, multi.slug), variants: [...input(multi, multi.slug).variants, { name: "Böyük", sku: `BIG-${run}`, costMinor: 100, priceMinor: 2500, stock: 5 }] }, actor);
    const q = (tail = "") => new URLSearchParams(`category=${c.slug}&${tail}`);
    const filtered = await catalog(q("min=20&max=30&sort=price-asc"));
    expect(filtered.products.find(p => p.id === multi.id)!.variants.map(v => v.priceMinor)).toEqual([2500]);
    expect(filtered.products.flatMap(p => p.variants).every(v => (v.discountMinor ?? v.priceMinor) >= 2000)).toBe(true);
    const first = await catalog(q("sort=price-asc")), second = await catalog(q("sort=price-asc&page=2"));
    expect(new Set([...first.products, ...second.products].map(p => p.id)).size).toBe(15);
    expect((await catalog(q("page=1.5"))).page).toBe(1); expect((await catalog(q("page=9999"))).page).toBe(2);
    const names = [...(await catalog(q("sort=name"))).products, ...(await catalog(q("sort=name&page=2"))).products].map(p => p.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("az", { sensitivity: "base", numeric: true }).compare));
    await expect(catalog(q("min=30&max=2"))).rejects.toMatchObject({ status: 400 });
    const publicProduct = first.products[0]; expect(publicProduct).not.toHaveProperty("needsPriceReview"); expect(publicProduct.variants[0]).not.toHaveProperty("costMinor");
  });
});
