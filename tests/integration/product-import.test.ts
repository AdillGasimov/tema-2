import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { csv } from "../../src/lib/csv";
import { importProducts, previewProductImport } from "../../src/lib/product-import";

const prefix = `csv-${randomUUID().slice(0, 8)}`;
const actor = `owner-${prefix}`;
let categoryId: string;
const headers = ["name", "sku", "price", "cost", "stock", "slug", "variant", "description", "category"];
const entry = (suffix: string, variant = "Standart", skuSuffix = suffix) => [`CSV ${suffix}`, `${prefix}-${skuSuffix}`, "14.99", "8.50", "7", `${prefix}-${suffix}`, variant, "CSV test məhsulu", ""];
const file = (...rows: string[][]) => csv([headers, ...rows]);
beforeAll(async () => {
  categoryId = (await db.productCategory.create({ data: { name: `CSV ${prefix}`, slug: prefix } })).id;
});
afterAll(() => db.$disconnect());

describe("transactional product CSV import", () => {
  it("previews a category-selected file without creating products or stock movements", async () => {
    const preview = await previewProductImport(file(entry("preview")), categoryId);
    expect(preview).toMatchObject({ productCount: 1, variantCount: 1, issues: [] });
    expect(preview.rows[0]).toMatchObject({ line: 2, priceMinor: 1499, costMinor: 850, stock: 7 });
    expect(preview).not.toHaveProperty("products");
    expect(await db.product.count({ where: { slug: `${prefix}-preview` } })).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: actor } })).toBe(0);
  });
  it("creates grouped variants as drafts, records stock and audits the batch", async () => {
    const key = randomUUID(); const input = file(entry("group", "Yaşıl", "green"), entry("group", "Boz", "grey"));
    const result = await importProducts(input, categoryId, key, actor);
    expect(result).toEqual({ productCount: 1, variantCount: 2 });
    const product = await db.product.findUniqueOrThrow({ where: { slug: `${prefix}-group` }, include: { variants: { include: { movements: true } } } });
    expect(product.status).toBe("DRAFT"); expect(product.featured).toBe(false); expect(product.categoryId).toBe(categoryId);
    expect(product.variants).toHaveLength(2);
    for (const variant of product.variants) {
      expect(variant).toMatchObject({ priceMinor: 1499, costMinor: 850, stock: 7, reserved: 0 });
      expect(variant.movements).toHaveLength(1); expect(variant.movements[0]).toMatchObject({ kind: "ADJUSTMENT", quantity: 7 });
    }
    expect(await db.auditLog.count({ where: { actorId: actor, action: "product.import", entityId: key } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "product.create", entityId: product.id } })).toBe(1);
  });
  it("replays a request without duplicate products, inventory or audit entries", async () => {
    const key = randomUUID(), input = file(entry("retry"));
    const first = await importProducts(input, categoryId, key, actor);
    expect(await importProducts(input, categoryId, key, actor)).toEqual(first);
    const product = await db.product.findUniqueOrThrow({ where: { slug: `${prefix}-retry` }, include: { variants: { include: { movements: true } } } });
    expect(product.variants).toHaveLength(1); expect(product.variants[0].movements).toHaveLength(1);
    await expect(importProducts(input.replace("14.99", "19.99"), categoryId, key, actor)).rejects.toMatchObject({ status: 409 });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).priceMinor).toBe(1499);
  });
  it("handles concurrent identical requests once", async () => {
    const key = randomUUID(), input = file(entry("concurrent"));
    const results = await Promise.all([importProducts(input, categoryId, key, actor), importProducts(input, categoryId, key, actor)]);
    expect(results[0]).toEqual(results[1]);
    expect(await db.productVariant.count({ where: { sku: `${prefix}-concurrent` } })).toBe(1);
    expect(await db.auditLog.count({ where: { actorId: actor, entityId: key, action: "product.import" } })).toBe(1);
  });
  it("rejects duplicate SKU/slug batches without changing existing stock, reserved quantities or prices", async () => {
    const existing = await db.productVariant.findUniqueOrThrow({ where: { sku: `${prefix}-retry` } });
    await db.productVariant.update({ where: { id: existing.id }, data: { reserved: 2 } });
    const snapshot = await db.productVariant.findUniqueOrThrow({ where: { id: existing.id } });
    const input = file(entry("would-create"), entry("retry"));
    const preview = await previewProductImport(input, categoryId); expect(preview.issues.length).toBeGreaterThan(0);
    await expect(importProducts(input, categoryId, randomUUID(), actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.product.count({ where: { slug: `${prefix}-would-create` } })).toBe(0);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(snapshot);
  });
  it("reports category and file conflicts and rejects the entire batch", async () => {
    const a = entry("bad"); a[4] = "";
    await expect(importProducts(file(entry("valid"), a), categoryId, randomUUID(), actor)).rejects.toThrow("Stok");
    expect(await db.product.count({ where: { slug: `${prefix}-valid` } })).toBe(0);
    const unknown = entry("unknown"); unknown[8] = "not-a-real-category";
    expect((await previewProductImport(file(unknown), categoryId)).issues[0].message).toContain("Kateqoriya");
    expect((await previewProductImport(file(entry("no-category")))).issues[0].message).toContain("Kateqoriya");
    const repeated = file(entry("dup-file"), entry("dup-file"));
    expect((await previewProductImport(repeated, categoryId)).issues.some(i => i.message.includes("SKU faylda"))).toBe(true);
  });
  it("revalidates a previously clean preview when another product takes its SKU", async () => {
    const input = file(entry("stale")); expect((await previewProductImport(input, categoryId)).issues).toEqual([]);
    await importProducts(input, categoryId, randomUUID(), actor);
    await expect(importProducts(input, categoryId, randomUUID(), actor)).rejects.toMatchObject({ status: 409 });
    expect(await db.product.count({ where: { slug: `${prefix}-stale` } })).toBe(1);
  });
});
