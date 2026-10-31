import { db, transaction } from "./db";
import { z } from "zod";
import { audit } from "./commerce";
export async function partnerData(partnerId: string) {
  const p = await db.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { id: true, name: true, code: true, commissionMinor: true, createdAt: true } });
  const [orders, commissions, payouts, visits, disputes, adjustments, rule, settings, notifications] = await Promise.all([
    db.order.findMany({ where: { partnerId }, select: { reference: true, createdAt: true, status: true, commission: { select: { amountMinor: true, status: true } } }, orderBy: { createdAt: "desc" } }),
    db.commission.findMany({ where: { partnerId }, select: { id: true, amountMinor: true, status: true, eligibleAt: true, createdAt: true, order: { select: { reference: true } } }, orderBy: { createdAt: "desc" } }),
    db.payout.findMany({ where: { partnerId }, select: { id: true, amountMinor: true, method: true, reference: true, createdAt: true, allocations: { select: { amountMinor: true, commission: { select: { order: { select: { reference: true } } } } } } }, orderBy: { createdAt: "desc" } }),
    db.referralVisit.count({ where: { partnerId } }), db.referralDispute.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" } }),
    db.commissionAdjustment.findMany({ where: { partnerId }, select: { id: true, amountMinor: true, reason: true, createdAt: true, payoutId: true, commission: { select: { order: { select: { reference: true } } } } } }),
    db.commissionRule.findFirstOrThrow({ orderBy: { createdAt: "desc" } }),
    db.storeSettings.findUniqueOrThrow({ where: { id: "store" }, select: { domain: true } }),
    db.notification.findMany({ where: { userId: (await db.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { userId: true } })).userId, audience: "PARTNER" }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { partner: p, orders, commissions, payouts, visits, disputes, adjustments, notifications, referralUrl: `${settings.domain.replace(/\/$/, "")}/?ref=${p.code}`,
    rule: { amountMinor: p.commissionMinor ?? rule.amountMinor, minimumOrderMinor: rule.minimumOrderMinor, holdDays: rule.holdDays, payoutFrequency: rule.payoutFrequency } };
}
export async function submitDispute(raw: unknown, partnerId: string, actorId: string) {
  const v = z.object({ orderRef: z.string().max(80).optional(), orderDate: z.iso.date(), explanation: z.string().min(10).max(2000), support: z.string().max(2000).default("") }).strict().parse(raw);
  return transaction(async tx => {
    const result = await tx.referralDispute.create({ data: { ...v, orderDate: new Date(`${v.orderDate}T12:00:00+04:00`), partnerId } });
    await tx.notification.create({ data: { audience: "ADMIN", title: "Referal müraciəti", body: "Yeni müraciət yoxlama gözləyir." } });
    await audit(tx, actorId, "dispute.submit", "ReferralDispute", result.id); return { id: result.id, status: result.status };
  });
}
