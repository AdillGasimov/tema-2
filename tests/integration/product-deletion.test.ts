import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { adminMutation, getAdminData } from "../../src/lib/admin";
import { changeProductTrash } from "../../src/lib/product-deletion";
import { createOrder, updateOrder } from "../../src/lib/commerce";
import { catalog } from "../../src/lib/catalog";
import { analytics } from "../../src/lib/analytics";
import { previewPhotoImport, previewProductImport } from "../../src/lib/product-import";
import { importProductPhoto } from "../../src/lib/product-photo-import";
import { csv } from "../../src/lib/csv";

const prefix = `trash-${randomUUID().slice(0, 8)}`, actor = `owner-${prefix}`;
let categoryId: string;
beforeAll(async () => {
  categoryId = (await db.productCategory.create({ data: { name: prefix, slug: prefix } })).id;
  await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryRegions: "Bakı" } });
});
afterAll(() => db.$disconnect());
const payload = (suffix: string) => ({ name: `Trash ${prefix} ${suffix}`, slug: `${prefix}-${suffix}`, description: "Original product description", categoryId, status: "PUBLISHED", featured: true, variants: [{ name: "Standart", sku: `${prefix}-${suffix}`, costMinor: 700, priceMinor: 1499, stock: 10 }] });
async function product(suffix: string) {
  const created = await adminMutation("products", payload(suffix), actor) as { id: string };
  return db.product.findUniqueOrThrow({ where: { id: created.id }, include: { variants: true, images: true } });
}
function order(variantId: string) {
  return createOrder({ idempotencyKey: randomUUID(), name: "Deletion test customer", phone: "+994500005566", city: "Bakı", address: "Test address 12", items: [{ variantId, quantity: 2 }] });
}

describe("audited, reversible product deletion", () => {
  it("removes products from catalog, admin list and current inventory while keeping variants, movements and images", async () => {
    const p = await product("single"), image = { productId: p.id, key: `images/${randomUUID()}.webp`, alt: p.name };
    await db.productImage.create({ data: image });
    const variants = await db.productVariant.findMany({ where: { productId: p.id } });
    const movements = await db.inventoryMovement.findMany({ where: { variantId: variants[0].id } });
    expect(await changeProductTrash({ action: "delete", ids: [p.id] }, actor)).toEqual({ count: 1 });
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DELETED");
    expect(await db.productVariant.findMany({ where: { productId: p.id } })).toEqual(variants);
    expect(await db.inventoryMovement.findMany({ where: { variantId: variants[0].id } })).toEqual(movements);
    expect(await db.productImage.findUnique({ where: { key: image.key } })).toMatchObject(image);
    expect((await catalog(new URLSearchParams({ q: p.name }))).total).toBe(0);
    const listing = await getAdminData("products") as { products: { id: string }[] };
    expect(listing.products.some(item => item.id === p.id)).toBe(false);
    const trash = await getAdminData("products", new URLSearchParams({ view: "deleted" })) as { products: { id: string }[]; deletedView: boolean };
    expect(trash.deletedView).toBe(true); expect(trash.products.some(item => item.id === p.id)).toBe(true);
    const inventory = await getAdminData("inventory") as { variants: { id: string }[] };
    expect(inventory.variants.some(v => v.id === variants[0].id)).toBe(false);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "product.delete", entityId: p.id } })).toBe(1);
  });
  it("makes deletion and restoration safe under concurrent retries, restoring to draft with unchanged stock", async () => {
    const p = await product("retry");
    const deletes = await Promise.all([changeProductTrash({ action: "delete", ids: [p.id, p.id] }, actor), changeProductTrash({ action: "delete", ids: [p.id] }, actor)]);
    expect(deletes.reduce((n, result) => n + result.count, 0)).toBe(1);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "product.delete", entityId: p.id } })).toBe(1);
    const restores = await Promise.all([changeProductTrash({ action: "restore", ids: [p.id] }, actor), changeProductTrash({ action: "restore", ids: [p.id] }, actor)]);
    expect(restores.reduce((n, result) => n + result.count, 0)).toBe(1);
    const restored = await db.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: true, images: true } });
    expect(restored).toMatchObject({ name: p.name, slug: p.slug, status: "DRAFT", description: p.description, featured: p.featured, variants: p.variants, images: p.images });
    expect((await catalog(new URLSearchParams({ q: p.name }))).total).toBe(0);
    expect(await db.auditLog.count({ where: { actorId: actor, action: "product.restore", entityId: p.id } })).toBe(1);
  });
  it("deletes batches atomically and rejects unknown IDs without partially changing products", async () => {
    const a = await product("batch-a"), b = await product("batch-b");
    await expect(changeProductTrash({ action: "delete", ids: [a.id, "missing-id"] }, actor)).rejects.toMatchObject({ status: 404 });
    expect((await db.product.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("PUBLISHED");
    expect(await changeProductTrash({ action: "delete", ids: [a.id, b.id] }, actor)).toEqual({ count: 2 });
    expect(await db.product.count({ where: { id: { in: [a.id, b.id] }, status: "DELETED" } })).toBe(2);
    for (const raw of [{ action: "delete", ids: [] }, { action: "delete", ids: Array.from({ length: 101 }, () => a.id) }, { action: "permanent-delete", ids: [a.id] }, { action: "restore", ids: [a.id], status: "PUBLISHED" }]) await expect(changeProductTrash(raw, actor)).rejects.toThrow();
  });
  it("blocks stale edits, bulk publishing, inventory changes and CSV photo imports until restored", async () => {
    const p = await product("stale"); await changeProductTrash({ action: "delete", ids: [p.id] }, actor);
    await expect(adminMutation("products", { ...payload("stale"), id: p.id, variants: [{ ...payload("stale").variants[0], id: p.variants[0].id }] }, actor)).rejects.toMatchObject({ code: "P2025" });
    expect(await adminMutation("product-bulk", { ids: [p.id], status: "PUBLISHED" }, actor)).toMatchObject({ count: 0 });
    await expect(adminMutation("inventory", { variantId: p.variants[0].id, delta: 1, reason: "Stale inventory form" }, actor)).rejects.toMatchObject({ code: "P2025" });
    const url = "https://strgimgr.umico.az/img/product/1680/test.jpeg";
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    try { await expect(importProductPhoto({ sku: p.variants[0].sku, url }, actor)).rejects.toMatchObject({ status: 404 }); expect(fetcher).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
    expect((await previewPhotoImport(csv([["sku", "image_urls"], [p.variants[0].sku, url]]))).issues[0].message).toContain("SKU mağazada tapılmadı");
    const preview = await previewProductImport(csv([["name", "sku", "price", "cost", "stock", "slug"], [p.name, p.variants[0].sku, "14.99", "7", "10", p.slug]]), categoryId);
    expect(preview.issues.some(issue => issue.message.includes("Silinmişlər"))).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("DELETED");
  });
  it("keeps an existing reservation and order snapshots, rejects new checkout, and permits cancellation afterward", async () => {
    const p = await product("reserved"), existing = await order(p.variants[0].id);
    const snapshot = await db.order.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true, payments: true, history: true } });
    const variant = await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } });
    await changeProductTrash({ action: "delete", ids: [p.id] }, actor);
    expect(await db.order.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true, payments: true, history: true } })).toEqual(snapshot);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).toEqual(variant);
    await expect(order(variant.id)).rejects.toThrow("Məhsul artıq satışda deyil");
    await updateOrder({ action: "status", orderId: existing.id, status: "CANCELED" }, actor);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).toMatchObject({ stock: 10, reserved: 0 });
    expect((await db.order.findUniqueOrThrow({ where: { id: existing.id } })).status).toBe("CANCELED");
  });
  it("preserves paid completed orders, payment history and financial totals after deletion", async () => {
    const p = await product("paid"), existing = await order(p.variants[0].id);
    for (const status of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]) await updateOrder({ action: "status", orderId: existing.id, status }, actor);
    await updateOrder({ action: "payment", orderId: existing.id, kind: "PAYMENT", amountMinor: existing.totalMinor, method: "test", reference: prefix, idempotencyKey: randomUUID() }, actor);
    await updateOrder({ action: "status", orderId: existing.id, status: "COMPLETED" }, actor);
    const snapshot = await db.order.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true, payments: true, commission: true, history: true } });
    const before = await analytics();
    await changeProductTrash({ action: "delete", ids: [p.id] }, actor);
    expect(await db.order.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true, payments: true, commission: true, history: true } })).toEqual(snapshot);
    const after = await analytics();
    for (const field of ["revenue", "cogs", "grossProfit", "commissions", "contribution"] as const) expect(after[field]).toEqual(before[field]);
  });
});
