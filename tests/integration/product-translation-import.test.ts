import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { csv } from "../../src/lib/csv";
import { createTranslationDraft, translatedProductCsv } from "../../src/lib/product-translation-csv";
import { importProducts, previewProductImport } from "../../src/lib/product-import";

const prefix = `az-${randomUUID().slice(0, 8)}`, actor = `translation-${prefix}`;
const image = "https://img.kwcdn.com/product/fancy/translation-test.jpg";
const header = ["name", "sku", "price", "cost", "stock", "slug", "variant", "description", "discount", "image_urls", "source_currency"];
let categoryId: string, externalCalls = 0;
beforeAll(async () => { categoryId = (await db.productCategory.create({ data: { name: `Tərcümə ${prefix}`, slug: prefix } })).id; });
beforeEach(() => { externalCalls = 0; vi.stubGlobal("fetch", () => { externalCalls++; throw new Error("External work must not run inside CSV import"); }); });
afterEach(() => vi.unstubAllGlobals());
afterAll(() => db.$disconnect());

function prepared(suffix: string, name: string, grouped = false) {
  const first = ["Microfiber cloth", `${prefix}-${suffix}-one`, "14,99", "5.00", "7", `supplier-${prefix}-${suffix}`, "Yaşıl", "Microfiber cloth.", "12,99", image, "USD"];
  const rows = [first];
  if (grouped) { const second = [...first]; second[1] = `${prefix}-${suffix}-two`; second[2] = "15.99"; second[3] = "6.00"; second[4] = "4"; second[6] = "Boz"; second[8] = ""; rows.push(second); }
  const draft = createTranslationDraft(csv([header, ...rows]));
  return translatedProductCsv(draft, { [draft.groups[0].id]: { name, shortDescription: "Yumşaq mikrofiber dəsmal.", description: "Mikrofiber dəsmal.\nMaterial: mikrofiber." } });
}

describe("translated CSV transaction compatibility", () => {
  it("creates reviewed grouped drafts and replays once with exact prices, stock and photo jobs", async () => {
    const name = `Mikrofiber dəsmal ${prefix}`, slug = `mikrofiber-desmal-${prefix}`, ready = prepared("grouped", name, true);
    const preview = await previewProductImport(ready, categoryId);
    expect(preview).toMatchObject({ productCount: 1, variantCount: 2, issues: [] });
    expect(preview.photos).toEqual([{ sku: `${prefix}-grouped-one`, url: image }]);
    expect(await db.product.count({ where: { slug } })).toBe(0);
    const key = randomUUID();
    expect(await importProducts(ready, categoryId, key, actor)).toEqual({ productCount: 1, variantCount: 2 });
    const product = await db.product.findUniqueOrThrow({ where: { slug }, include: { variants: { include: { movements: true } } } });
    expect(product).toMatchObject({ name, status: "DRAFT", categoryId, shortDescription: "Yumşaq mikrofiber dəsmal.", description: "Mikrofiber dəsmal.\nMaterial: mikrofiber." });
    expect(product.variants.find(v => v.sku === `${prefix}-grouped-one`)).toMatchObject({ name: "Yaşıl", priceMinor: 1499, costMinor: 500, stock: 7, discountMinor: 1299, storeSku: expect.stringMatching(/^FC-\d+$/) });
    expect(product.variants.find(v => v.sku === `${prefix}-grouped-two`)).toMatchObject({ name: "Boz", priceMinor: 1599, costMinor: 600, stock: 4, discountMinor: null });
    expect(product.variants.every(v => v.movements.length === 1)).toBe(true);
    expect(await importProducts(ready, categoryId, key, actor)).toEqual({ productCount: 1, variantCount: 2 });
    expect(await db.productVariant.count({ where: { productId: product.id } })).toBe(2);
    expect(await db.inventoryMovement.count({ where: { variantId: { in: product.variants.map(v => v.id) } } })).toBe(2);
    expect(await db.auditLog.count({ where: { action: "product.import", entityId: key } })).toBe(1);
    await expect(importProducts(ready.replace('"14,99"', '"20,00"'), categoryId, key, actor)).rejects.toMatchObject({ status: 409 });
    expect((await db.productVariant.findUniqueOrThrow({ where: { sku: `${prefix}-grouped-one` } })).priceMinor).toBe(1499);
    expect(externalCalls).toBe(0);
  });
  it("rejects a prepared slug reserved for URL history without creating inventory", async () => {
    const name = `Tərcümə yoxlaması ${prefix}`, slug = `tercume-yoxlamasi-${prefix}`, ready = prepared("alias", name);
    const existing = await db.product.create({ data: { name: "Existing product", description: "Existing product fixture.", slug: `existing-${prefix}`, categoryId, status: "DRAFT" } });
    await db.productSlugAlias.create({ data: { oldSlug: slug, productId: existing.id } });
    const count = await db.inventoryMovement.count();
    expect((await previewProductImport(ready, categoryId)).issues.some(i => i.message.includes("əvvəlki məhsul"))).toBe(true);
    await expect(importProducts(ready, categoryId, randomUUID(), actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.product.count({ where: { slug } })).toBe(0);
    expect(await db.inventoryMovement.count()).toBe(count); expect(externalCalls).toBe(0);
  });
  it("revalidates a cached prepared file against products created after preview", async () => {
    const ready = prepared("stale", `Tərcümə edilmiş dəsmal ${prefix}`);
    expect((await previewProductImport(ready, categoryId)).issues).toEqual([]);
    await importProducts(ready, categoryId, randomUUID(), actor);
    const snapshot = await db.productVariant.findUniqueOrThrow({ where: { sku: `${prefix}-stale-one` } });
    await expect(importProducts(ready, categoryId, randomUUID(), actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.productVariant.findUniqueOrThrow({ where: { sku: snapshot.sku } })).toEqual(snapshot);
    expect(externalCalls).toBe(0);
  });
});
