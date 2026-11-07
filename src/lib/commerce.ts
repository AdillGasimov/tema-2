import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { checkoutSchema, codeSchema, id, minor } from "./validation";
import { deliveryCharge } from "./delivery";
import { paymentState } from "./money";
import { transitions, canConfirmDelivery } from "./order-status";
export { transitions } from "./order-status";

export async function audit(tx: Tx, actorId: string, action: string, entity: string, entityId: string, detail: Prisma.InputJsonValue = {}) {
  await tx.auditLog.create({ data: { actorId, action, entity, entityId, detail } });
}
async function notify(tx: Tx, audience: string, title: string, body: string, userId?: string) {
  await tx.notification.create({ data: { audience, userId, title, body } });
}
async function queueSync(tx: Tx, orderId: string) {
  await tx.integrationSyncJob.upsert({ where: { orderId }, create: { orderId }, update: { status: "PENDING", version: { increment: 1 }, nextRunAt: new Date() } });
}
export async function expireReservations(tx: Tx) {
  const orders = await tx.order.findMany({ where: { inventoryState: "RESERVED", reservationExpiresAt: { lte: new Date() } }, include: { items: true } });
  for (const order of orders) {
    for (const item of order.items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { reserved: { decrement: item.quantity } } });
      await tx.inventoryMovement.create({ data: { variantId: item.variantId, orderId: order.id, kind: "RELEASE", quantity: item.quantity, reason: "Rezerv vaxtı bitdi" } });
    }
    await tx.order.update({ where: { id: order.id }, data: { inventoryState: "RELEASED" } });
  }
}
export async function createOrder(raw: unknown, cookieCode?: string | null) {
  const input = checkoutSchema.parse(raw);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const execute = () => transaction(async tx => {
    const existing = await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new AppError("Bu sorğu açarı başqa sifariş üçün istifadə edilib.", 409);
      return existing;
    }
    const settings = await tx.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
    if (!settings.whatsapp) throw new AppError("Sifariş qəbulu hələ aktiv deyil. Mağaza ilə əlaqə saxlayın.", 503);
    if (!settings.deliveryRegions.split(",").map(x => x.trim()).includes(input.city)) throw new AppError("Çatdırılma bölgəsini seçin.");
    const finalCode = input.referralCode !== undefined ? input.referralCode : cookieCode;
    const normalized = finalCode ? codeSchema.safeParse(finalCode) : null;
    if (normalized && !normalized.success) throw new AppError("Referal kodu düzgün deyil.");
    const partner = normalized?.success ? await tx.partner.findUnique({ where: { code: normalized.data } }) : null;
    if (finalCode && (!partner || partner.status !== "ACTIVE")) throw new AppError("Referal kodu tapılmadı və ya aktiv deyil.");
    await expireReservations(tx);
    const quantities = new Map<string, number>();
    for (const item of input.items) quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    const productCommissions: number[] = [];
    let subtotalMinor = 0;
    for (const [variantId, quantity] of quantities) {
      const v = await tx.productVariant.findUnique({ where: { id: variantId }, include: { product: { include: { category: true } } } });
      if (!v || !v.active || v.product.status !== "PUBLISHED") throw new AppError("Məhsul artıq satışda deyil.");
      if (quantity > 100 || v.stock - v.reserved < quantity) throw new AppError(`${v.product.name}: kifayət qədər stok yoxdur.`, 409);
      const unitPriceMinor = v.discountMinor ?? v.priceMinor;
      subtotalMinor += unitPriceMinor * quantity;
      if (v.commissionMinor !== null) productCommissions.push(v.commissionMinor);
      items.push({ variant: { connect: { id: variantId } }, productName: v.product.name, variantName: v.name, sku: v.sku, categoryName: v.product.category.name,
        quantity, unitPriceMinor, unitCostMinor: v.costMinor });
      await tx.productVariant.update({ where: { id: variantId }, data: { reserved: { increment: quantity } } });
    }
    if (subtotalMinor > 100_000_000) throw new AppError("Sifariş məbləği icazə verilən həddi keçir.");
    const deliveryChargedMinor = deliveryCharge(settings, subtotalMinor, input.city);
    const rule = await tx.commissionRule.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    const customer = await tx.customer.upsert({ where: { phone: input.phone }, create: { name: input.name, phone: input.phone }, update: { name: input.name } });
    const order = await tx.order.create({ data: {
      reference: `ORD-${randomBytes(6).toString("hex").toUpperCase()}`, idempotencyKey: input.idempotencyKey, requestHash,
      customerId: customer.id, customerName: input.name, phone: input.phone, city: input.city, address: input.address, notes: input.notes,
      subtotalMinor, deliveryChargedMinor, totalMinor: subtotalMinor + deliveryChargedMinor,
      reservationExpiresAt: new Date(Date.now() + 30 * 60000), commissionRuleId: rule.id,
      commissionMinor: partner?.commissionMinor ?? (productCommissions.length ? Math.max(...productCommissions) : rule.amountMinor),
      minimumOrderMinor: rule.minimumOrderMinor, holdDays: rule.holdDays,
      partnerId: partner?.id, referralCode: partner?.code,
      items: { create: items }, history: { create: { status: "WHATSAPP_PENDING", note: "Sifariş sorğusu qeydə alındı; ödəniş təsdiqlənməyib." } },
      ...(partner ? { attribution: { create: { partnerId: partner.id, code: partner.code, source: input.referralCode !== undefined ? "MANUAL" : "LINK" } } } : {}),
    }, include: { items: true } });
    for (const item of order.items) await tx.inventoryMovement.create({ data: { variantId: item.variantId, orderId: order.id, kind: "RESERVE", quantity: item.quantity, reason: "30 dəqiqəlik sifariş rezervi" } });
    await notify(tx, "ADMIN", "Yeni sifariş sorğusu", order.reference);
    if (partner) await notify(tx, "PARTNER", "Yeni referal sifarişi", `${order.reference} — təsdiq gözlənilir`, partner.userId);
    await queueSync(tx, order.id);
    return order;
  });
  try { return await execute(); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
      if (existing && existing.requestHash === requestHash) return existing;
    }
    throw error;
  }
}
export function whatsappMessage(order: Awaited<ReturnType<typeof createOrder>>) {
  const amount = (n: number) => `${(n / 100).toFixed(2)} AZN`;
  return ["Salam!", "Sifariş vermək istəyirəm.", `Sifariş nömrəsi: ${order.reference}`, "", "Məhsullar:",
    ...order.items.map(i => `- ${i.productName} (${i.variantName}) — ${i.quantity} ədəd — ${amount(i.unitPriceMinor * i.quantity)}`),
    `Çatdırılma: ${amount(order.deliveryChargedMinor)}`, `Ümumi məbləğ: ${amount(order.totalMinor)}`, "",
    `Ad: ${order.customerName}`, `Telefon: ${order.phone}`, `Ünvan: ${order.city}, ${order.address}`,
    ...(order.notes ? [`Qeyd: ${order.notes}`] : []), ...(order.referralCode ? [`Referal kodu: ${order.referralCode}`] : []),
  ].join("\n");
}
async function reverseCommission(tx: Tx, orderId: string, reason: string) {
  const c = await tx.commission.findUnique({ where: { orderId } });
  if (!c || c.status === "REVERSED") return;
  if (c.status === "PAID") {
    await tx.commissionAdjustment.upsert({ where: { commissionId: c.id }, update: {}, create: { commissionId: c.id, partnerId: c.partnerId, amountMinor: -c.amountMinor, reason } });
  } else await tx.commission.update({ where: { id: c.id }, data: { status: "REVERSED" } });
  const partner = await tx.partner.findUniqueOrThrow({ where: { id: c.partnerId } });
  await notify(tx, "PARTNER", "Komissiya düzəlişi", `${reason}. Ödəniş tarixçəsi saxlanılıb.`, partner.userId);
}
async function completeDeliveredOrder(tx: Tx, orderId: string, actorId: string, source: "delivery" | "payment" | "status") {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "DELIVERED" || order.deliveryStatus !== "DELIVERED" || order.inventoryState !== "DEDUCTED" || order.paidMinor - order.refundedMinor < order.totalMinor) return false;
  const completedAt = new Date();
  await tx.order.update({ where: { id: order.id }, data: { status: "COMPLETED", completedAt,
    history: { create: { status: "COMPLETED", actorId, note: "Çatdırılma və tam ödəniş təsdiqləndi; sifariş tamamlandı." } } } });
  if (order.partnerId && order.subtotalMinor >= order.minimumOrderMinor && order.commissionMinor > 0) {
    await tx.commission.upsert({ where: { orderId: order.id }, update: {}, create: { orderId: order.id, partnerId: order.partnerId,
      ruleId: order.commissionRuleId, amountMinor: order.commissionMinor, eligibleAt: new Date(completedAt.getTime() + order.holdDays * 86400000) } });
    await notify(tx, "ADMIN", "Komissiya təsdiq gözləyir", order.reference);
  }
  await audit(tx, actorId, "order.complete", "Order", order.id, { source });
  return true;
}
export const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deliver"), orderId: id, note: z.string().max(1000).default("") }).strict(),
  z.object({ action: z.literal("status"), orderId: id, status: z.enum(["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "RETURNED"]), note: z.string().max(1000).default("") }),
  z.object({ action: z.literal("payment"), orderId: id, kind: z.enum(["PAYMENT", "REFUND"]), amountMinor: minor.min(1), method: z.string().min(1).max(80), reference: z.string().min(1).max(160), idempotencyKey: z.uuid() }),
  z.object({ action: z.literal("costs"), orderId: id, deliveryCostMinor: minor, packagingCostMinor: minor, note: z.string().max(1000).default("") }),
  z.object({ action: z.literal("attribution"), orderId: id, code: codeSchema, note: z.string().min(5).max(1000) }),
]);
export async function updateOrder(raw: unknown, actorId: string) {
  const input = orderActionSchema.parse(raw);
  return transaction(async tx => {
    await expireReservations(tx);
    const order = await tx.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { items: true, commission: true } });
    if (input.action === "deliver") {
      if (order.status === "COMPLETED" && order.deliveryStatus === "DELIVERED") return order;
      if (order.status === "DELIVERED" && order.deliveryStatus === "DELIVERED") {
        if (!await completeDeliveredOrder(tx, order.id, actorId, "delivery")) return order;
      } else {
        if (!canConfirmDelivery(order.status) || order.inventoryState !== "DEDUCTED") throw new AppError("Əvvəl sifarişi təsdiqləyin. Bağlanmış sifarişdə çatdırılma dəyişdirilmir.", 409);
        await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveryStatus: "DELIVERED",
          history: { create: { status: "DELIVERED", actorId, note: input.note || "Admin çatdırılmanı təsdiqlədi." } } } });
        await completeDeliveredOrder(tx, order.id, actorId, "delivery");
      }
    } else if (input.action === "status") {
      if (order.status === input.status) return order;
      if (!transitions[order.status]?.includes(input.status)) throw new AppError("Bu status keçidi mümkün deyil.");
      if (input.status === "COMPLETED") {
        if (!await completeDeliveredOrder(tx, order.id, actorId, "status")) throw new AppError("Tamamlanma üçün çatdırılma, təsdiqlənmiş stok və tam ödəniş tələb olunur.");
      } else {
        let inventoryState = order.inventoryState;
        if (input.status === "CONFIRMED") {
          for (const item of order.items) {
            const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId } });
            const ownReservation = order.inventoryState === "RESERVED" ? item.quantity : 0;
            if (v.stock - v.reserved + ownReservation < item.quantity) throw new AppError("Sifarişi təsdiqləmək üçün stok kifayət deyil.", 409);
            await tx.productVariant.update({ where: { id: v.id }, data: { stock: { decrement: item.quantity }, reserved: { decrement: ownReservation } } });
            await tx.inventoryMovement.create({ data: { variantId: v.id, orderId: order.id, kind: "SALE", quantity: -item.quantity, reason: "Admin təsdiqi" } });
            if (v.stock - item.quantity <= v.lowStock) await notify(tx, "ADMIN", "Az stok", `${item.productName} · ${item.sku}`);
          }
          inventoryState = "DEDUCTED";
        }
        if (["CANCELED", "RETURNED"].includes(input.status)) {
          for (const item of order.items) {
            if (inventoryState === "RESERVED") await tx.productVariant.update({ where: { id: item.variantId }, data: { reserved: { decrement: item.quantity } } });
            if (inventoryState === "DEDUCTED") await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
            if (["RESERVED", "DEDUCTED"].includes(inventoryState)) await tx.inventoryMovement.create({ data: { variantId: item.variantId, orderId: order.id, kind: inventoryState === "RESERVED" ? "RELEASE" : "RETURN", quantity: item.quantity, reason: input.note || input.status } });
          }
          inventoryState = inventoryState === "DEDUCTED" ? "RESTORED" : "RELEASED";
          await reverseCommission(tx, order.id, input.status);
        }
        const deliveryStatus = input.status === "SHIPPED" ? "SHIPPED" : input.status === "DELIVERED" ? "DELIVERED" : input.status === "RETURNED" ? "RETURNED" : input.status === "CANCELED" ? "CANCELED" : order.deliveryStatus;
        await tx.order.update({ where: { id: order.id }, data: { status: input.status, inventoryState, deliveryStatus,
          history: { create: { status: input.status, note: input.note || input.status, actorId } } } });
        if (input.status === "DELIVERED") await completeDeliveredOrder(tx, order.id, actorId, "delivery");
      }
    } else if (input.action === "payment") {
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.orderId !== order.id || existing.kind !== input.kind || existing.amountMinor !== input.amountMinor || existing.reference !== input.reference || existing.method !== input.method) throw new AppError("Ödəniş açarı başqa sorğuya aiddir.", 409);
        return order;
      }
      if (input.kind === "PAYMENT" && (["CANCELED", "RETURNED"].includes(order.status) || order.paidMinor - order.refundedMinor + input.amountMinor > order.totalMinor)) throw new AppError("Ödəniş sifariş məbləğini keçir və ya sifariş bağlıdır.");
      if (input.kind === "REFUND" && input.amountMinor > order.paidMinor - order.refundedMinor) throw new AppError("Geri ödəniş alınmış məbləğdən çox ola bilməz.");
      await tx.payment.create({ data: { orderId: order.id, idempotencyKey: input.idempotencyKey, kind: input.kind, amountMinor: input.amountMinor, method: input.method, reference: input.reference } });
      const paid = order.paidMinor + (input.kind === "PAYMENT" ? input.amountMinor : 0);
      const refunded = order.refundedMinor + (input.kind === "REFUND" ? input.amountMinor : 0);
      await tx.order.update({ where: { id: order.id }, data: { paidMinor: paid, refundedMinor: refunded, paymentStatus: paymentState(paid, refunded, order.totalMinor), history: { create: { status: order.status, actorId, note: `${input.kind}: ${input.amountMinor} qəpik · ${input.reference}` } } } });
      if (input.kind === "REFUND") await reverseCommission(tx, order.id, "Geri ödəniş");
      else await completeDeliveredOrder(tx, order.id, actorId, "payment");
    } else if (input.action === "costs") {
      await tx.order.update({ where: { id: order.id }, data: { deliveryCostMinor: input.deliveryCostMinor, packagingCostMinor: input.packagingCostMinor, history: { create: { status: order.status, actorId, note: input.note || "Xərclər yeniləndi" } } } });
    } else {
      if (order.completedAt || order.commission || ["CANCELED", "RETURNED"].includes(order.status)) throw new AppError("Bağlanmış sifarişin referalını dəyişmək olmaz. Maliyyə düzəlişi ayrıca yoxlanmalıdır.");
      const partner = await tx.partner.findUnique({ where: { code: input.code } });
      if (!partner || partner.status !== "ACTIVE") throw new AppError("Aktiv tərəfdaş tapılmadı.");
      const rule = await tx.commissionRule.findUniqueOrThrow({ where: { id: order.commissionRuleId } });
      await tx.order.update({ where: { id: order.id }, data: { partnerId: partner.id, referralCode: partner.code, commissionMinor: partner.commissionMinor ?? rule.amountMinor } });
      await tx.referralAttribution.upsert({ where: { orderId: order.id }, create: { orderId: order.id, partnerId: partner.id, code: partner.code, source: "ADMIN" }, update: { partnerId: partner.id, code: partner.code, source: "ADMIN" } });
    }
    await audit(tx, actorId, `order.${input.action}`, "Order", order.id, input);
    await queueSync(tx, order.id);
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, commission: true, history: true, payments: true } });
  });
}
export async function approveCommission(commissionId: string, actorId: string, payable = false) {
  return transaction(async tx => {
    const c = await tx.commission.findUniqueOrThrow({ where: { id: commissionId }, include: { order: true, partner: true } });
    if (c.order.status !== "COMPLETED" || c.order.paymentStatus !== "PAID") throw new AppError("Sifariş komissiya üçün uyğun deyil.");
    if (c.eligibleAt > new Date()) throw new AppError("Qaytarma gözləmə müddəti bitməyib.");
    const next = payable ? "PAYABLE" : "APPROVED";
    if (c.status === next) return c;
    if (c.status !== (payable ? "APPROVED" : "PENDING")) throw new AppError("Komissiyanın statusu uyğun deyil.");
    const result = await tx.commission.update({ where: { id: c.id }, data: { status: next, approvedAt: c.approvedAt ?? new Date() } });
    await audit(tx, actorId, `commission.${next}`, "Commission", c.id);
    await notify(tx, "PARTNER", "Komissiya təsdiqləndi", c.order.reference, c.partner.userId);
    await queueSync(tx, c.orderId);
    return result;
  });
}
export const payoutSchema = z.object({ partnerId: id, commissionIds: z.array(id).min(1).max(500).refine(ids => new Set(ids).size === ids.length),
  amountMinor: minor.min(1), method: z.string().min(1).max(80), reference: z.string().min(1).max(160), idempotencyKey: z.uuid() }).strict();
export async function createPayout(raw: unknown, actorId: string) {
  const input = payoutSchema.parse(raw);
  return transaction(async tx => {
    const existing = await tx.payout.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { allocations: true } });
    if (existing) {
      if (existing.partnerId !== input.partnerId || existing.amountMinor !== input.amountMinor || existing.reference !== input.reference || existing.method !== input.method || [...existing.allocations.map(a => a.commissionId)].sort().join() !== [...input.commissionIds].sort().join()) throw new AppError("Ödəniş açarı başqa sorğuya aiddir.", 409);
      return existing;
    }
    const commissions = await tx.commission.findMany({ where: { id: { in: input.commissionIds }, partnerId: input.partnerId, status: "PAYABLE", order: { status: "COMPLETED", paymentStatus: "PAID" } } });
    if (commissions.length !== input.commissionIds.length) throw new AppError("Yalnız bu tərəfdaşın ödənişə hazır komissiyaları seçilə bilər.", 409);
    const adjustments = await tx.commissionAdjustment.findMany({ where: { partnerId: input.partnerId, payoutId: null } });
    const expected = commissions.reduce((s, c) => s + c.amountMinor, 0) + adjustments.reduce((s, a) => s + a.amountMinor, 0);
    if (expected <= 0 || expected !== input.amountMinor) throw new AppError("Məbləğ komissiyalar və açıq düzəlişlərin cəminə bərabər olmalıdır.");
    const payout = await tx.payout.create({ data: { partnerId: input.partnerId, idempotencyKey: input.idempotencyKey, amountMinor: input.amountMinor, method: input.method, reference: input.reference,
      allocations: { create: commissions.map(c => ({ commissionId: c.id, amountMinor: c.amountMinor })) } } });
    await tx.commission.updateMany({ where: { id: { in: input.commissionIds } }, data: { status: "PAID", paidAt: new Date() } });
    await tx.commissionAdjustment.updateMany({ where: { id: { in: adjustments.map(a => a.id) } }, data: { payoutId: payout.id } });
    await audit(tx, actorId, "payout.record", "Payout", payout.id, { commissionIds: input.commissionIds, adjustments: adjustments.map(a => a.id), amountMinor: expected });
    const partner = await tx.partner.findUniqueOrThrow({ where: { id: input.partnerId } });
    await notify(tx, "PARTNER", "Ödəniş qeydə alındı", `${input.reference} · ${(expected / 100).toFixed(2)} AZN`, partner.userId);
    for (const c of commissions) await queueSync(tx, c.orderId);
    return payout;
  });
}
