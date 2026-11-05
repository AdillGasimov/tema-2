import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { adminMutation } from "../../src/lib/admin";
import { createOrder, updateOrder, approveCommission } from "../../src/lib/commerce";
const suffix = randomUUID().slice(0, 8), actor = `quick-order-${suffix}`;
let variantId: string, zeroVariantId: string, code: string;
beforeAll(async () => {
  await db.storeSettings.update({ where: { id: "store" }, data: { whatsapp: "+994500000000", deliveryRegions: "Bakı", deliveryFeeMinor: 0, freeDeliveryMinor: 0 } });
  await db.commissionRule.create({ data: { amountMinor: 200, holdDays: 2 } });
  const category = await db.productCategory.findFirstOrThrow();
  const product = await db.product.create({ data: { name: `Quick order ${suffix}`, slug: `quick-order-${suffix}`, description: "Test fixture", categoryId: category.id, status: "PUBLISHED", variants: { create: [{ name: "Standart", sku: `QUICK-${suffix}`, priceMinor: 1500, costMinor: 500, stock: 100 }, { name: "No commission", sku: `ZERO-${suffix}`, priceMinor: 1500, costMinor: 500, stock: 100, commissionMinor: 0 }] } }, include: { variants: true } });
  variantId = product.variants.find(v => v.commissionMinor === null)!.id; zeroVariantId = product.variants.find(v => v.commissionMinor === 0)!.id;
  code = `QUICK${suffix.toUpperCase()}`;
  await adminMutation("partners", { name: "Quick order test partner", phone: "+994500009999", email: `quick-${suffix}@example.test`, password: randomUUID() + randomUUID(), category: "Test", code }, actor);
});
afterAll(() => db.$disconnect());
const checkout = (withReferral = true, variant = variantId) => createOrder({ idempotencyKey: randomUUID(), name: "Quick order test customer", phone: "+994500008888", city: "Bakı", address: "Test address 12", referralCode: withReferral ? code : undefined, items: [{ variantId: variant, quantity: 1 }] });
const confirm = (orderId: string) => updateOrder({ action: "status", orderId, status: "CONFIRMED" }, actor);
const deliver = (orderId: string) => updateOrder({ action: "deliver", orderId }, actor);
const payment = (orderId: string, amountMinor = 1500, kind = "PAYMENT") => ({ action: "payment", orderId, kind, amountMinor, method: "cash", reference: `test-${randomUUID()}`, idempotencyKey: randomUUID() });

describe("two-step order processing with audited automatic completion", () => {
  it("completes a paid confirmed order in one delivery action without inventing preparation/shipping or charging again", async () => {
    const order = await checkout(); await confirm(order.id); await updateOrder(payment(order.id), actor);
    const before = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const saved = await deliver(order.id); expect(saved).toMatchObject({ status: "COMPLETED", deliveryStatus: "DELIVERED", paymentStatus: "PAID", inventoryState: "DEDUCTED", paidMinor: 1500, refundedMinor: 0 });
    expect(saved.completedAt).not.toBeNull(); expect(await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).toEqual(before);
    const history = await db.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(history.filter(h => h.status === "DELIVERED")).toHaveLength(1); expect(history.filter(h => h.status === "COMPLETED")).toHaveLength(1);
    expect(history.some(h => ["PREPARING", "SHIPPED"].includes(h.status))).toBe(false);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    const commission = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } }); expect(commission).toMatchObject({ amountMinor: 200, status: "PENDING" });
    expect(commission.eligibleAt.getTime() - saved.completedAt!.getTime()).toBe(2 * 86400000);
    await expect(approveCommission(commission.id, actor)).rejects.toThrow("gözləmə");
  });
  it("keeps an unpaid delivered order open until the final real payment, then creates commission once", async () => {
    const order = await checkout(); await confirm(order.id);
    const delivered = await deliver(order.id); expect(delivered).toMatchObject({ status: "DELIVERED", deliveryStatus: "DELIVERED", paidMinor: 0, completedAt: null });
    expect(await db.commission.count({ where: { orderId: order.id } })).toBe(0);
    await updateOrder(payment(order.id, 500), actor);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DELIVERED");
    const finalPayment = payment(order.id, 1000); const complete = await updateOrder(finalPayment, actor); expect(complete.status).toBe("COMPLETED");
    await updateOrder(finalPayment, actor); await deliver(order.id);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(2); expect(await db.commission.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: order.id, action: "order.complete" } })).toBe(1);
  });
  it("finishes a previously delivered and paid legacy order without charging or deducting stock again", async () => {
    const order = await checkout(); await confirm(order.id); await updateOrder(payment(order.id), actor);
    // Reproduce a record left at the delivery stage by the previous release.
    // Its payment and inventory were recorded through the real business APIs.
    await db.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveryStatus: "DELIVERED" } });
    const stock = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const completed = await updateOrder({ action: "status", orderId: order.id, status: "COMPLETED" }, actor);
    expect(completed.status).toBe("COMPLETED"); expect(await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).toEqual(stock);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1); expect(await db.commission.count({ where: { orderId: order.id } })).toBe(1);
  });
  it("serializes simultaneous delivery and payment, with harmless retries and one sale/commission/completion", async () => {
    const order = await checkout(); await confirm(order.id); const receipt = payment(order.id);
    const before = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    await Promise.all([deliver(order.id), updateOrder(receipt, actor)]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COMPLETED");
    const job = await db.integrationSyncJob.findUniqueOrThrow({ where: { orderId: order.id } });
    await Promise.all([deliver(order.id), deliver(order.id), updateOrder(receipt, actor)]);
    expect(await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).toEqual(before);
    expect(await db.integrationSyncJob.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(job);
    expect(await db.inventoryMovement.count({ where: { orderId: order.id, kind: "SALE" } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1); expect(await db.commission.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.orderStatusHistory.count({ where: { orderId: order.id, status: "COMPLETED" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: order.id, action: "order.complete" } })).toBe(1);
    expect(await db.notification.count({ where: { title: "Komissiya təsdiq gözləyir", body: order.reference } })).toBe(1);
  });
  it("rejects unconfirmed delivery, generic completion skips and injected payment fields, and preserves cancellation/return accounting", async () => {
    const order = await checkout(); await expect(deliver(order.id)).rejects.toMatchObject({ status: 409 });
    await expect(updateOrder({ action: "deliver", orderId: order.id, paidMinor: 1500 }, actor)).rejects.toThrow();
    await confirm(order.id); await updateOrder(payment(order.id), actor);
    await expect(updateOrder({ action: "status", orderId: order.id, status: "COMPLETED" }, actor)).rejects.toThrow("keçidi");
    await deliver(order.id); const sold = await db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    await updateOrder({ action: "status", orderId: order.id, status: "RETURNED" }, actor); await expect(deliver(order.id)).rejects.toMatchObject({ status: 409 });
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock).toBe(sold.stock + 1);
    expect((await db.commission.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("REVERSED");
    const canceled = await checkout(); await updateOrder({ action: "status", orderId: canceled.id, status: "CANCELED" }, actor);
    await expect(deliver(canceled.id)).rejects.toMatchObject({ status: 409 }); expect(await db.commission.count({ where: { orderId: canceled.id } })).toBe(0);
  });
  it("uses net payment after refunds and does not complete an order whose payment no longer covers its total", async () => {
    const order = await checkout(); await confirm(order.id); await updateOrder(payment(order.id), actor);
    await updateOrder(payment(order.id, 100, "REFUND"), actor); const result = await deliver(order.id);
    expect(result).toMatchObject({ status: "DELIVERED", paidMinor: 1500, refundedMinor: 100, completedAt: null });
    expect(await db.commission.count({ where: { orderId: order.id } })).toBe(0);
  });
  it("finishes direct or zero-commission orders without fabricating a referral commission", async () => {
    for (const [withReferral, variant] of [[false, variantId], [true, zeroVariantId]] as const) {
      const order = await checkout(withReferral, variant); await confirm(order.id); await updateOrder(payment(order.id), actor);
      expect((await deliver(order.id)).status).toBe("COMPLETED"); expect(await db.commission.count({ where: { orderId: order.id } })).toBe(0);
    }
  });
  it("continues to honor the snapshotted minimum order amount", async () => {
    await db.commissionRule.create({ data: { amountMinor: 200, minimumOrderMinor: 2000, holdDays: 2 } });
    try {
      const order = await checkout(); expect(order.minimumOrderMinor).toBe(2000);
      await confirm(order.id); await updateOrder(payment(order.id), actor); expect((await deliver(order.id)).status).toBe("COMPLETED");
      expect(await db.commission.count({ where: { orderId: order.id } })).toBe(0);
    } finally { await db.commissionRule.create({ data: { amountMinor: 200, holdDays: 2 } }); }
  });
});
