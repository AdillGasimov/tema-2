import { db } from "./db";
import { bakuDay } from "./money";
export async function analytics(from?: Date, to?: Date) {
  // A cohort report: all cash/refunds and historical costs for orders created in this range.
  const createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  const [orders, expenses, activePartners, lowStock] = await Promise.all([
    db.order.findMany({ where: { createdAt }, include: { items: true, partner: { select: { name: true, code: true } }, commission: { include: { adjustments: true } } } }),
    db.expense.findMany({ where: { date: createdAt } }), db.partner.count({ where: { status: "ACTIVE" } }),
    db.productVariant.findMany({ where: { active: true, product: { status: "PUBLISHED" } }, include: { product: { select: { name: true } } } }),
  ]);
  const revenue = orders.reduce((s, o) => s + o.paidMinor - o.refundedMinor, 0);
  const cogs = orders.reduce((s, o) => s + (o.inventoryState === "DEDUCTED" && o.deliveryStatus === "DELIVERED" ? o.items.reduce((v, i) => v + i.unitCostMinor * i.quantity, 0) : 0), 0);
  const commissions = orders.reduce((s, o) => s + (o.commission && o.commission.status !== "REVERSED" ? o.commission.amountMinor + o.commission.adjustments.reduce((n, a) => n + a.amountMinor, 0) : 0), 0);
  const delivery = orders.reduce((s, o) => s + o.deliveryCostMinor, 0);
  const packaging = orders.reduce((s, o) => s + o.packagingCostMinor, 0);
  const other = expenses.reduce((s, e) => s + e.amountMinor, 0);
  const trends = new Map<string, { date: string; revenue: number; orders: number; referral: number }>();
  const productMap = new Map<string, { name: string; sku: string; revenue: number; cost: number; quantity: number; category: string }>();
  const partnerMap = new Map<string, { name: string; revenue: number; contribution: number; orders: number }>();
  for (const o of orders) {
    const day = bakuDay(o.createdAt);
    const trend = trends.get(day) ?? { date: day, revenue: 0, orders: 0, referral: 0 };
    trend.revenue += o.paidMinor - o.refundedMinor; trend.orders++; if (o.partnerId) trend.referral += o.paidMinor - o.refundedMinor; trends.set(day, trend);
    if (o.inventoryState === "DEDUCTED" && o.deliveryStatus === "DELIVERED") for (const i of o.items) {
      const row = productMap.get(i.sku) ?? { name: i.productName, sku: i.sku, revenue: 0, cost: 0, quantity: 0, category: i.categoryName };
      // Allocate net merchandise cash proportionally after customer delivery charge.
      const merchandiseNet = Math.max(0, o.paidMinor - o.refundedMinor - o.deliveryChargedMinor);
      row.revenue += Math.floor(merchandiseNet * (i.unitPriceMinor * i.quantity) / Math.max(1, o.subtotalMinor));
      row.cost += i.unitCostMinor * i.quantity; row.quantity += i.quantity; productMap.set(i.sku, row);
    }
    if (o.partner) {
      const row = partnerMap.get(o.partner.code) ?? { name: o.partner.name, revenue: 0, contribution: 0, orders: 0 };
      const cash = o.paidMinor - o.refundedMinor;
      const cost = o.inventoryState === "DEDUCTED" && o.deliveryStatus === "DELIVERED" ? o.items.reduce((s, i) => s + i.unitCostMinor * i.quantity, 0) : 0;
      const fee = o.commission && o.commission.status !== "REVERSED" ? o.commission.amountMinor + o.commission.adjustments.reduce((s, a) => s + a.amountMinor, 0) : 0;
      row.revenue += cash; row.contribution += cash - cost - fee - o.deliveryCostMinor - o.packagingCostMinor; row.orders++; partnerMap.set(o.partner.code, row);
    }
  }
  return { revenue, cogs, grossProfit: revenue - cogs, commissions, delivery, packaging, other, contribution: revenue - cogs - commissions - delivery - packaging - other,
    totalOrders: orders.length, newOrders: orders.filter(o => o.status === "WHATSAPP_PENDING").length,
    completedOrders: orders.filter(o => o.status === "COMPLETED").length, canceledOrders: orders.filter(o => o.status === "CANCELED").length,
    paidOrders: orders.filter(o => o.paymentStatus === "PAID").length, activePartners,
    averageOrder: orders.filter(o => o.paidMinor > o.refundedMinor).length ? Math.round(revenue / orders.filter(o => o.paidMinor > o.refundedMinor).length) : 0,
    trends: [...trends.values()].sort((a, b) => a.date.localeCompare(b.date)), products: [...productMap.values()], partners: [...partnerMap.values()],
    lowStock: lowStock.filter(v => v.stock - v.reserved <= v.lowStock).map(v => ({ name: v.product.name, sku: v.sku, available: v.stock - v.reserved })),
  };
}
