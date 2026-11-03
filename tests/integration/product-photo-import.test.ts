import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db } from "../../src/lib/db";
import { csv } from "../../src/lib/csv";
import { catalog } from "../../src/lib/catalog";
import { previewPhotoImport, previewProductImport } from "../../src/lib/product-import";
import { importProductPhoto } from "../../src/lib/product-photo-import";
import { imageBytes } from "../../src/lib/storage";

const prefix = `photos-${randomUUID().slice(0, 8)}`, actor = `owner-${prefix}`;
const url = (name: string) => `https://strgimgr.umico.az/img/product/1680/${name}.jpeg`;
let productId: string, categoryId: string, pixels: Uint8Array<ArrayBuffer>;
const input = (name: string, sku = `${prefix}-1`) => ({ sku, url: url(name) });
function remoteImage() { const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(pixels, { headers: { "content-type": "image/png" } }))); vi.stubGlobal("fetch", fetcher); return fetcher; }
beforeAll(async () => {
  pixels = new Uint8Array(await sharp({ create: { width: 30, height: 20, channels: 3, background: "green" } }).png().toBuffer());
  categoryId = (await db.productCategory.create({ data: { name: prefix, slug: prefix } })).id;
  const product = await db.product.create({ data: { name: `Photo ${prefix}`, slug: prefix, description: "Original owner description", categoryId, status: "PUBLISHED", variants: { create: [1, 2].map(n => ({ name: `Variant ${n}`, sku: `${prefix}-${n}`, priceMinor: 1499, costMinor: 700, stock: 9, reserved: 2 })) } } });
  productId = product.id;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => db.$disconnect());

describe("CSV photos with real PostgreSQL and object storage", () => {
  it("previews images for existing products by SKU without requiring or editing financial fields", async () => {
    const before = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } });
    const text = csv([["sku", "image_urls", "price", "cost", "stock", "source_price_azn"], [`${prefix}-1`, url("preview"), "", "", "", "99.99"], [`${prefix}-2`, url("preview"), "1", "1", "10000", "1"]]);
    const preview = await previewPhotoImport(text);
    expect(preview).toMatchObject({ kind: "photos", productCount: 1, variantCount: 2, issues: [], photos: [input("preview")] });
    expect(preview.rows[0]).toMatchObject({ name: before.name, priceMinor: null, costMinor: null, stock: null, imageCount: 1 });
    expect(await db.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } })).toEqual(before);
    expect(await db.productImage.count({ where: { productId } })).toBe(0);
  });
  it("includes deduplicated photo jobs in a new-product preview without uploading bytes", async () => {
    const preview = await previewProductImport(csv([["name", "sku", "price", "cost", "stock", "slug", "image_urls"], ["New photo product", `${prefix}-new`, "14.99", "7", "9", `${prefix}-new`, `${url("one")} | ${url("one")}`]]), categoryId);
    expect(preview).toMatchObject({ issues: [], photos: [input("one", `${prefix}-new`)] });
    expect(await db.product.count({ where: { slug: `${prefix}-new` } })).toBe(0);
  });
  it("copies, normalizes and audits a remote photo without changing published status, price or stock", async () => {
    const fetcher = remoteImage();
    const before = await db.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } });
    expect(await importProductPhoto(input("first"), actor)).toEqual({ attached: true });
    const image = await db.productImage.findFirstOrThrow({ where: { productId } });
    expect(image.key).toMatch(/^images\/[a-f0-9-]{36}\.webp$/); expect(image.sourceUrlHash).toHaveLength(64); expect(image.alt).toBe(before.name);
    expect((await sharp(Buffer.from(await imageBytes(image.key))).metadata()).format).toBe("webp");
    expect(await db.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: true } })).toEqual(before);
    expect(await db.inventoryMovement.count({ where: { variant: { productId } } })).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "image.import", entityId: productId } })).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const publicData = await catalog(new URLSearchParams({ q: prefix }));
    expect(publicData.products[0].images[0].key).toBe(image.key); expect(JSON.stringify(publicData)).not.toContain("sourceUrlHash");
  });
  it("skips retries even through a different variant SKU and reports no pending images", async () => {
    const fetcher = remoteImage();
    expect(await importProductPhoto(input("first", `${prefix}-2`), actor)).toEqual({ attached: false });
    expect(fetcher).not.toHaveBeenCalled();
    const preview = await previewPhotoImport(csv([["sku", "image_urls"], [`${prefix}-1`, url("first")]]));
    expect(preview.issues).toEqual([]); expect(preview.photos).toEqual([]);
    expect(await db.productImage.count({ where: { productId } })).toBe(1);
  });
  it("attaches concurrent duplicate source URLs once and leaves one audit record", async () => {
    remoteImage();
    const results = await Promise.all([importProductPhoto(input("concurrent"), actor), importProductPhoto(input("concurrent", `${prefix}-2`), actor)]);
    expect(results.filter(r => r.attached)).toHaveLength(1);
    expect(await db.productImage.count({ where: { productId } })).toBe(2);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "image.import", entityId: productId } })).toBe(2);
  });
  it("rejects forged image bytes, unknown SKUs, unsafe URLs and invalid photo previews without writes", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("not really an image", { headers: { "content-type": "image/jpeg" } })); vi.stubGlobal("fetch", fetcher);
    await expect(importProductPhoto(input("forged"), actor)).rejects.toThrow("Şəkil faylı oxunmadı");
    await expect(importProductPhoto(input("missing", `${prefix}-missing`), actor)).rejects.toMatchObject({ status: 404 });
    await expect(importProductPhoto({ sku: `${prefix}-1`, url: "https://127.0.0.1/x.jpg" }, actor)).rejects.toThrow("Yalnız Birmarket");
    expect(fetcher).toHaveBeenCalledTimes(1); expect(await db.productImage.count({ where: { productId } })).toBe(2);
    expect((await previewPhotoImport(csv([["sku", "image_urls"], [`${prefix}-missing`, url("unknown")]]))).issues[0].message).toContain("SKU mağazada tapılmadı");
  });
  it("enforces the twelve-photo limit under concurrent downloads", async () => {
    remoteImage();
    const full = await db.product.create({ data: { name: "Photo limit", slug: `${prefix}-limit`, description: "", categoryId, variants: { create: { name: "Standart", sku: `${prefix}-limit`, priceMinor: 100, costMinor: 0 } }, images: { create: Array.from({ length: 11 }, (_, n) => ({ key: `images/${randomUUID()}.webp`, alt: "Existing", position: n })) } } });
    const results = await Promise.allSettled([importProductPhoto(input("limit-a", `${prefix}-limit`), actor), importProductPhoto(input("limit-b", `${prefix}-limit`), actor)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await db.productImage.count({ where: { productId: full.id } })).toBe(12);
    const preview = await previewPhotoImport(csv([["sku", "image_urls"], [`${prefix}-limit`, url("one-too-many")]]));
    expect(preview.issues[0].message).toContain("12 şəkil");
  });
});
