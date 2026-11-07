import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { checkoutSchema } from "../../src/lib/validation";
import { db } from "../../src/lib/db";
import { adminMutation } from "../../src/lib/admin";
import { createOrder, updateOrder, approveCommission, createPayout } from "../../src/lib/commerce";
import { catalog } from "../../src/lib/catalog";
import { analytics } from "../../src/lib/analytics";
import { partnerData } from "../../src/lib/partner";
import { submitDispute } from "../../src/lib/partner";
import { syncSheets } from "../../src/lib/sheets";
import { uploadImage, imageBytes } from "../../src/lib/storage";
import sharp from "sharp";
const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
let variantId: string, partnerId: string, productId: string, ruleId: string;
const actor = `test-${suffix}`;
const checkout = (overrides = {}) => ({ idempotencyKey: randomUUID(), name: "Test müştəri", phone: "+994500001111", city: "Bakı", address: "Test ünvanı 12", notes: "Test", referralCode: `P${suffix}`, items: [{ variantId, quantity: 1 }], ...overrides });
beforeAll(async () => {
  await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryFeeMinor: 0, freeDeliveryMinor: 0, sheetsEnabled: false } });
  const rule = await db.commissionRule.create({ data: { amountMinor: 200, holdDays: 0 } }); ruleId = rule.id;
  const category = await db.productCategory.findFirstOrThrow();
  const product = await adminMutation("products", { name: `Test məhsul ${suffix}`, slug: `test-${suffix.toLowerCase()}`, description: "Test təsviri", categoryId: category.id, status: "PUBLISHED", featured: true, variants: [{ name: "Standart", sku: suffix, costMinor: 500, priceMinor: 1500, stock: 20 }] }, actor) as { id: string };
  productId = product.id; variantId = (await db.productVariant.findFirstOrThrow({ where: { productId } })).id;
  const partner = await adminMutation("partners", { name: "Test tərəfdaş", phone: "+994500002222", email: `${suffix.toLowerCase()}@example.test`, password: `Secure-Test-${suffix}-password`, category: "Avtoyuma", code: `P${suffix}`, commissionMinor: 200 }, actor) as { id: string }; partnerId = partner.id;
});
afterAll(() => db.$disconnect());
async function complete(orderId: string) {
  for (const status of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]) await updateOrder({ action: "status", orderId, status }, actor);
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await updateOrder({ action: "payment", orderId, kind: "PAYMENT", amountMinor: o.totalMinor, method: "cash", reference: `test-${orderId}`, idempotencyKey: randomUUID() }, actor);
  await updateOrder({ action: "status", orderId, status: "COMPLETED" }, actor);
}
describe("real PostgreSQL business lifecycle", () => {
  it("rejects malformed checkout phones before creating customers, orders or stock reservations", async () => {
    const counts = async () => ({ customers: await db.customer.count(), orders: await db.order.count(), movements: await db.inventoryMovement.count(), variant: await db.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true, reserved: true } }) });
    const before = await counts();
    for (const phone of ["+99450abc4567", "+994501234567#", "+491234567890", "50123"]) await expect(createOrder(checkout({ phone }))).rejects.toThrow();
    expect(await counts()).toEqual(before);
  });
  it("publishes products without leaking costs; validates minor-unit price filters", async () => {
    const data = await catalog(new URLSearchParams({ q: suffix, min: "14.99", max: "15.01" }));
    expect(data.total).toBe(1); expect(JSON.stringify(data)).not.toContain("costMinor"); expect(JSON.stringify(data)).not.toContain("commissionMinor");
  });
  it("uploads and decodes real images, refusing SVG and forged bytes", async () => {
    const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "green" } }).png().toBuffer();
    const key = await uploadImage(new File([new Uint8Array(bytes)], "test.png", { type: "image/png" }));
    expect((await sharp(Buffer.from(await imageBytes(key))).metadata()).format).toBe("webp");
    await expect(uploadImage(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow();
    await expect(uploadImage(new File(["not png"], "x.png", { type: "image/png" }))).rejects.toThrow();
  });
  it("saves before WhatsApp and retries the same checkout without duplicate reservations", async () => {
    const input = checkout(); const [a, b] = await Promise.all([createOrder(input), createOrder(input)]);
    expect(a.id).toBe(b.id); expect(a.status).toBe("WHATSAPP_PENDING"); expect(a.paidMinor).toBe(0); expect(a.commissionRuleId).toBe(ruleId);
    expect(await db.commission.count({ where: { orderId: a.id } })).toBe(0);
    const before = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(before.stock).toBe(20); expect(before.reserved).toBe(1);
    await expect(createOrder({ ...input, address: "A different address" })).rejects.toThrow();
    await updateOrder({ action: "status", orderId: a.id, status: "CANCELED" }, actor);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).reserved).toBe(0);
  });
  it("retries legacy local-format phone orders without changing history or reserving stock again", async () => {
    const input = checkout({ phone: "0501234567" }); const order = await createOrder(input);
    const legacy = { ...checkoutSchema.parse(input), phone: "0501234567" };
    await db.order.update({ where: { id: order.id }, data: { phone: legacy.phone, requestHash: createHash("sha256").update(JSON.stringify(legacy)).digest("hex") } });
    const reserved = await db.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true, reserved: true } });
    const history = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, history: true } });
    expect((await createOrder({ ...input, phone: "+994501234567" })).id).toBe(order.id);
    expect(await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, history: true } })).toEqual(history);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true, reserved: true } })).toEqual(reserved);
    await expect(createOrder({ ...input, address: "Changed address" })).rejects.toThrow("sorğu açarı");
    await updateOrder({ action: "status", orderId: order.id, status: "CANCELED" }, actor);
  });
  it("rejects invalid and suspended partner codes and honors manual referral over cookie", async () => {
    await expect(createOrder(checkout({ referralCode: "INVALID999" }))).rejects.toThrow();
    const p = await db.partner.create({ data: { userId: (await db.user.create({ data: { id: randomUUID(), email: `${suffix}-other@example.test`, name: "Other", role: "PARTNER" } })).id, name: "Other", phone: "+994500000002", category: "Servis", code: `Q${suffix}`, status: "SUSPENDED" } });
    await expect(createOrder(checkout({ referralCode: p.code }))).rejects.toThrow();
    await db.partner.update({ where: { id: p.id }, data: { status: "ACTIVE" } });
    const order = await createOrder(checkout(), p.code); expect(order.partnerId).toBe(partnerId);
    await updateOrder({ action: "status", orderId: order.id, status: "CANCELED" }, actor);
    const cookie = await createOrder(checkout({ referralCode: undefined }), p.code); expect(cookie.partnerId).toBe(p.id);
    await updateOrder({ action: "status", orderId: cookie.id, status: "CANCELED" }, actor);
  });
  it("rejects overselling during concurrent checkout", async () => {
    const v = await db.productVariant.create({ data: { productId, name: "Last one", sku: `LAST${suffix}`, costMinor: 100, priceMinor: 500, stock: 1 } });
    const result = await Promise.allSettled([createOrder(checkout({ items: [{ variantId: v.id, quantity: 1 }] })), createOrder(checkout({ items: [{ variantId: v.id, quantity: 1 }] }))]);
    expect(result.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(result.filter(x => x.status === "rejected")).toHaveLength(1);
  });
  it("retries concurrent serializable writes while stock is sufficient", async () => {
    const v = await db.productVariant.create({ data: { productId, name: "Concurrent", sku: `RACE${suffix}`, costMinor: 100, priceMinor: 500, stock: 5 } });
    const orders = await Promise.all(Array.from({ length: 5 }, () => createOrder(checkout({ items: [{ variantId: v.id, quantity: 1 }] }))));
    expect(new Set(orders.map(o => o.id)).size).toBe(5); expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).reserved).toBe(5);
    for (const o of orders) await updateOrder({ action: "status", orderId: o.id, status: "CANCELED" }, actor);
  });
  it("preserves price/cost snapshots and prevents unpaid completion", async () => {
    const o = await createOrder(checkout());
    await db.productVariant.update({ where: { id: variantId }, data: { priceMinor: 1900, costMinor: 700 } });
    expect(o.totalMinor).toBe(1500); expect(o.items[0].unitCostMinor).toBe(500);
    await expect(updateOrder({ action: "status", orderId: o.id, status: "COMPLETED" }, actor)).rejects.toThrow();
    for (const status of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]) await updateOrder({ action: "status", orderId: o.id, status }, actor);
    await expect(updateOrder({ action: "status", orderId: o.id, status: "COMPLETED" }, actor)).rejects.toThrow();
    await updateOrder({ action: "status", orderId: o.id, status: "RETURNED" }, actor);
    await db.productVariant.update({ where: { id: variantId }, data: { priceMinor: 1500, costMinor: 500 } });
  });
  it("completes, accrues once, approves and pays exact allocations; paid reversals retain history", async () => {
    const o = await createOrder(checkout()); await complete(o.id);
    await updateOrder({ action: "status", orderId: o.id, status: "COMPLETED" }, actor);
    expect(await db.commission.count({ where: { orderId: o.id } })).toBe(1);
    const c = await db.commission.findUniqueOrThrow({ where: { orderId: o.id } }); expect(c.amountMinor).toBe(200);
    await approveCommission(c.id, actor); await approveCommission(c.id, actor, true);
    const payload = { partnerId, commissionIds: [c.id], amountMinor: 200, method: "bank", reference: `BANK-${suffix}`, idempotencyKey: randomUUID() };
    const p = await createPayout(payload, actor); expect((await createPayout(payload, actor)).id).toBe(p.id);
    await expect(createPayout({ ...payload, idempotencyKey: randomUUID() }, actor)).rejects.toThrow();
    const refund = { action: "payment", orderId: o.id, kind: "REFUND", amountMinor: 1500, method: "bank", reference: `REFUND-${suffix}`, idempotencyKey: randomUUID() };
    await updateOrder(refund, actor); await updateOrder(refund, actor);
    expect(await db.commissionAdjustment.count({ where: { commissionId: c.id } })).toBe(1);
    expect((await db.commission.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PAID");
    expect(await db.payoutAllocation.count({ where: { commissionId: c.id } })).toBe(1);
    await updateOrder({ action: "status", orderId: o.id, status: "RETURNED" }, actor);
  });
  it("unpaid reversal is never payable; hold periods cannot be bypassed", async () => {
    const o = await createOrder(checkout()); await complete(o.id); const c = await db.commission.findUniqueOrThrow({ where: { orderId: o.id } });
    await db.commission.update({ where: { id: c.id }, data: { eligibleAt: new Date(Date.now() + 86400000) } });
    await expect(approveCommission(c.id, actor)).rejects.toThrow();
    await updateOrder({ action: "status", orderId: o.id, status: "RETURNED" }, actor);
    expect((await db.commission.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REVERSED");
    await expect(approveCommission(c.id, actor)).rejects.toThrow();
  });
  it("redacts partner data and never counts unconfirmed requests as revenue", async () => {
    const view = JSON.stringify(await partnerData(partnerId));
    for (const field of ["customerName", "phone", "address", "unitCostMinor", "costMinor", "requestHash"]) expect(view).not.toContain(`"${field}"`);
    const before = await analytics(); await createOrder(checkout()); const after = await analytics();
    expect(after.revenue).toBe(before.revenue);
  });
  it("expires reservations and safely reacquires stock at admin confirmation", async () => {
    const v = await db.productVariant.create({ data: { productId, name: "Expiry", sku: `EXP${suffix}`, costMinor: 100, priceMinor: 500, stock: 1 } });
    const expired = await createOrder(checkout({ items: [{ variantId: v.id, quantity: 1 }] }));
    await db.order.update({ where: { id: expired.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const current = await createOrder(checkout({ items: [{ variantId: v.id, quantity: 1 }] }));
    expect((await db.order.findUniqueOrThrow({ where: { id: expired.id } })).inventoryState).toBe("RELEASED");
    await expect(updateOrder({ action: "status", orderId: expired.id, status: "CONFIRMED" }, actor)).rejects.toThrow();
    await updateOrder({ action: "status", orderId: current.id, status: "CANCELED" }, actor);
    await updateOrder({ action: "status", orderId: expired.id, status: "CONFIRMED" }, actor);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).stock).toBe(0);
    await updateOrder({ action: "status", orderId: expired.id, status: "CANCELED" }, actor);
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: v.id } })).stock).toBe(1);
  });
  it("settles paid reversal adjustments in a later positive payout without erasing the original payment", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) { const order = await createOrder(checkout()); await complete(order.id); const c = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } }); await approveCommission(c.id, actor); await approveCommission(c.id, actor, true); ids.push(c.id); }
    const payout = await createPayout({ partnerId, commissionIds: ids, amountMinor: 200, method: "bank", reference: `OFFSET-${suffix}`, idempotencyKey: randomUUID() }, actor);
    expect(await db.payoutAllocation.count({ where: { payoutId: payout.id } })).toBe(2);
    const adjustments = await db.commissionAdjustment.findMany({ where: { payoutId: payout.id } }); expect(adjustments).toHaveLength(1); expect(adjustments[0].amountMinor).toBe(-200);
  });
  it("reconciles revenue, fulfilled historical costs and separately recorded expenses exactly", async () => {
    const before = await analytics(); const o = await createOrder(checkout()); await complete(o.id);
    await updateOrder({ action: "costs", orderId: o.id, deliveryCostMinor: 100, packagingCostMinor: 50 }, actor);
    await adminMutation("expenses", { category: "Test", amountMinor: 75, date: new Date().toISOString().slice(0, 10), description: `Expense ${suffix}` }, actor);
    const after = await analytics(); expect(after.revenue - before.revenue).toBe(1500); expect(after.cogs - before.cogs).toBe(500); expect(after.commissions - before.commissions).toBe(200); expect(after.contribution - before.contribution).toBe(575);
  });
  it("records and resolves a partner dispute with an audit trail", async () => {
    const p = await db.partner.findUniqueOrThrow({ where: { id: partnerId } });
    const d = await submitDispute({ orderDate: "2026-10-31", explanation: "Referalımı yoxlamağınızı xahiş edirəm." }, partnerId, p.userId);
    await adminMutation("disputes", { id: d.id, status: "RESOLVED", resolution: "Müraciət yoxlanıldı, sifariş təsdiqi gözlənilir." }, actor);
    expect((await db.referralDispute.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("RESOLVED");
    expect(await db.auditLog.count({ where: { entityId: d.id } })).toBe(2);
  });
  it("retries Sheets idempotently at the same row and preserves newer order versions", async () => {
    const o = await createOrder(checkout());
    await db.storeSettings.update({ where: { id: "store" }, data: { sheetsEnabled: true } });
    const rows: string[] = []; const writer = async (range: string) => { rows.push(range); };
    // Prioritize this fixture, independent of backlog left by earlier test runs.
    await db.integrationSyncJob.update({ where: { orderId: o.id }, data: { updatedAt: new Date(0) } });
    await syncSheets(writer);
    const job = await db.integrationSyncJob.findUniqueOrThrow({ where: { orderId: o.id } }); expect(job.status).toBe("DONE"); expect(job.sheetRow).not.toBeNull();
    await db.integrationSyncJob.update({ where: { id: job.id }, data: { status: "PENDING", nextRunAt: new Date(), updatedAt: new Date(0) } });
    await syncSheets(async () => { throw new Error("network down"); });
    expect((await db.integrationSyncJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("RETRY");
    await db.integrationSyncJob.update({ where: { id: job.id }, data: { nextRunAt: new Date(), updatedAt: new Date(0) } }); await syncSheets(writer);
    expect((await db.integrationSyncJob.findUniqueOrThrow({ where: { id: job.id } })).sheetRow).toBe(job.sheetRow);
    expect(rows.filter(r => r === `Orders!A${job.sheetRow}:K${job.sheetRow}`).length).toBe(2);
    await db.storeSettings.update({ where: { id: "store" }, data: { sheetsEnabled: false } });
  });
});
