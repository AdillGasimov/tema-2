import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { db, transaction } from "./db";
import { AppError } from "./errors";
import { audit, approveCommission, createPayout, updateOrder, expireReservations } from "./commerce";
import { productSchema, partnerSchema, settingsSchema, id, minor } from "./validation";
import { provisionAccount } from "./accounts";
import { analytics } from "./analytics";
import { assertProductSlugAvailable, lockProductSlugs, retainProductSlug } from "./product-slugs";

export const adminResources = ["overview", "products", "categories", "inventory", "orders", "customers", "partners", "cards", "commissions", "payouts", "analytics", "expenses", "reports", "settings", "disputes", "notifications", "audit", "integrations"] as const;
export async function getAdminData(resource: string, query = new URLSearchParams()) {
  switch (resource) {
    case "overview": case "analytics": case "reports": {
      const parsed = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }).parse({ from: query.get("from") || undefined, to: query.get("to") || undefined });
      return analytics(parsed.from ? new Date(`${parsed.from}T00:00:00+04:00`) : undefined, parsed.to ? new Date(`${parsed.to}T23:59:59.999+04:00`) : undefined);
    }
    case "products": return { products: await db.product.findMany({ where: { status: query.get("view") === "deleted" ? "DELETED" : { not: "DELETED" } }, include: { category: true, variants: true, images: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } }), categories: await db.productCategory.findMany(), deletedView: query.get("view") === "deleted", deletedCount: await db.product.count({ where: { status: "DELETED" } }) };
    case "categories": return db.productCategory.findMany({ include: { _count: { select: { products: { where: { status: { not: "DELETED" } } } } } }, orderBy: { name: "asc" } });
    case "inventory": await transaction(expireReservations); return { variants: await db.productVariant.findMany({ where: { product: { status: { not: "DELETED" } } }, include: { product: { select: { name: true } } }, orderBy: { sku: "asc" } }), movements: await db.inventoryMovement.findMany({ include: { variant: { select: { sku: true } } }, orderBy: { createdAt: "desc" }, take: 200 }) };
    case "orders": return db.order.findMany({ include: { items: true, partner: { select: { name: true, code: true } }, commission: true, history: { orderBy: { createdAt: "desc" } }, payments: true, attribution: true }, orderBy: { createdAt: "desc" }, take: 300 });
    case "customers": return db.customer.findMany({ include: { orders: { select: { reference: true, status: true, totalMinor: true, paidMinor: true, refundedMinor: true, createdAt: true } } }, orderBy: { createdAt: "desc" } });
    case "partners": case "cards": return db.partner.findMany({ include: { _count: { select: { visits: true, orders: true } } }, orderBy: { createdAt: "desc" } });
    case "commissions": return db.commission.findMany({ include: { partner: { select: { name: true, code: true } }, order: { select: { reference: true } }, adjustments: true }, orderBy: { createdAt: "desc" } });
    case "payouts": return { partners: await db.partner.findMany({ select: { id: true, name: true, code: true } }), commissions: await db.commission.findMany({ where: { status: "PAYABLE" }, include: { order: { select: { reference: true } } } }), adjustments: await db.commissionAdjustment.findMany({ where: { payoutId: null } }), payouts: await db.payout.findMany({ include: { partner: { select: { name: true } }, allocations: true, adjustments: true }, orderBy: { createdAt: "desc" } }) };
    case "expenses": return db.expense.findMany({ orderBy: { date: "desc" } });
    case "settings": return { settings: await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } }), rule: await db.commissionRule.findFirstOrThrow({ orderBy: { createdAt: "desc" } }) };
    case "disputes": return db.referralDispute.findMany({ include: { partner: { select: { name: true, code: true } } }, orderBy: { createdAt: "desc" } });
    case "notifications": return db.notification.findMany({ where: { audience: "ADMIN" }, orderBy: { createdAt: "desc" }, take: 100 });
    case "audit": return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
    case "integrations": return db.integrationSyncJob.findMany({ include: { order: { select: { reference: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
    default: throw new AppError("Bölmə tapılmadı.", 404);
  }
}
export async function adminMutation(resource: string, raw: unknown, actorId: string) {
  if (resource === "orders") return updateOrder(raw, actorId);
  if (resource === "commissions") { const v = z.object({ id, action: z.enum(["approve", "payable"]) }).parse(raw); return approveCommission(v.id, actorId, v.action === "payable"); }
  if (resource === "payouts") return createPayout(raw, actorId);
  if (resource === "product-bulk") {
    const v = z.object({ ids: z.array(id).min(1).max(100), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }).strict().parse(raw);
    return transaction(async tx => {
      const products = await tx.product.findMany({ where: { id: { in: v.ids }, status: { not: "DELETED" } }, select: { id: true } });
      const result = await tx.product.updateMany({ where: { id: { in: products.map(p => p.id) } }, data: { status: v.status } });
      for (const product of products) await audit(tx, actorId, "product.bulk-status", "Product", product.id, { status: v.status }); return result;
    });
  }
  if (resource === "products") {
    const v = productSchema.parse(raw);
    return transaction(async tx => {
      const { variants, id: productId, ...data } = v;
      await lockProductSlugs(tx);
      await assertProductSlugAvailable(tx, data.slug, productId);
      const previous = productId ? await tx.product.findUniqueOrThrow({ where: { id: productId, status: { not: "DELETED" } }, select: { slug: true } }) : null;
      const product = productId ? await tx.product.update({ where: { id: productId, status: { not: "DELETED" } }, data }) : await tx.product.create({ data });
      if (previous && previous.slug !== product.slug) await retainProductSlug(tx, product.id, previous.slug);
      const current = await tx.productVariant.findMany({ where: { productId: product.id } });
      const kept: string[] = [];
      for (const variant of variants) {
        const { id: variantId, stock, ...fields } = variant;
        const existing = variantId ? current.find(x => x.id === variantId) : null;
        if (variantId && !existing) throw new AppError("Variant bu məhsula aid deyil.");
        if (existing && stock < existing.reserved) throw new AppError("Stok rezerv sayından az ola bilməz.");
        const saved = existing ? await tx.productVariant.update({ where: { id: existing.id }, data: { ...fields, stock } }) : await tx.productVariant.create({ data: { productId: product.id, ...fields, stock } });
        kept.push(saved.id);
        const delta = stock - (existing?.stock ?? 0);
        if (delta) await tx.inventoryMovement.create({ data: { variantId: saved.id, kind: "ADJUSTMENT", quantity: delta, reason: "Məhsul forması ilə stok yeniləndi" } });
      }
      await tx.productVariant.updateMany({ where: { productId: product.id, id: { notIn: kept } }, data: { active: false } });
      await audit(tx, actorId, productId ? "product.update" : "product.create", "Product", product.id, { status: product.status, ...(previous && previous.slug !== product.slug ? { previousSlug: previous.slug, slug: product.slug } : {}) });
      return product;
    });
  }
  if (resource === "categories") {
    const v = z.object({ id: id.optional(), name: z.string().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]+$/).max(160), parentId: id.nullable().default(null), featured: z.boolean().default(false) }).parse(raw);
    return transaction(async tx => {
      if (v.id && v.parentId === v.id) throw new AppError("Kateqoriya öz alt kateqoriyası ola bilməz.");
      let cursor = v.parentId;
      const visited = new Set<string>();
      while (cursor) { if (cursor === v.id || visited.has(cursor)) throw new AppError("Kateqoriya dövrəsi mümkün deyil."); visited.add(cursor); const parent = await tx.productCategory.findUniqueOrThrow({ where: { id: cursor } }); cursor = parent.parentId; }
      const { id: categoryId, ...data } = v;
      const result = categoryId ? await tx.productCategory.update({ where: { id: categoryId }, data }) : await tx.productCategory.create({ data });
      await audit(tx, actorId, "category.save", "Category", result.id); return result;
    });
  }
  if (resource === "inventory") {
    const v = z.object({ variantId: id, delta: z.number().int().min(-1000000).max(1000000).refine(n => n !== 0), reason: z.string().min(3).max(500) }).parse(raw);
    return transaction(async tx => { await expireReservations(tx); const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: v.variantId, product: { status: { not: "DELETED" } } } });
      if (variant.stock + v.delta < variant.reserved) throw new AppError("Stok rezerv sayından az ola bilməz.");
      const result = await tx.productVariant.update({ where: { id: v.variantId }, data: { stock: { increment: v.delta } } });
      await tx.inventoryMovement.create({ data: { variantId: v.variantId, kind: "ADJUSTMENT", quantity: v.delta, reason: v.reason } });
      await audit(tx, actorId, "inventory.adjust", "Variant", variant.id, v); return result;
    });
  }
  if (resource === "partners") {
    const v = partnerSchema.parse(raw);
    return transaction(async tx => {
      const { id: partnerId, password, ...fields } = v;
      const loginEmail = fields.email ? fields.email.toLowerCase() : `${fields.code.toLowerCase()}@partners.invalid`;
      let result;
      if (partnerId) {
        const old = await tx.partner.findUniqueOrThrow({ where: { id: partnerId } });
        if (old.code !== v.code) throw new AppError("Tarixçəni qorumaq üçün mövcud referal kodu dəyişdirilmir.");
        result = await tx.partner.update({ where: { id: partnerId }, data: { ...fields, email: fields.email ? fields.email.toLowerCase() : null } });
        await tx.user.update({ where: { id: old.userId }, data: { name: fields.name, email: loginEmail } });
        if (password) { await tx.account.updateMany({ where: { userId: old.userId, providerId: "credential" }, data: { password: await hashPassword(password) } }); }
        if (password || old.status !== fields.status || old.email !== fields.email) await tx.session.deleteMany({ where: { userId: old.userId } });
      } else {
        if (!password) throw new AppError("Yeni hesab üçün ən azı 12 simvolluq parol tələb olunur.");
        const userId = await provisionAccount(tx, fields.name, loginEmail, password, "PARTNER");
        result = await tx.partner.create({ data: { ...fields, email: fields.email ? fields.email.toLowerCase() : null, userId, auth: { create: {} } } });
      }
      await audit(tx, actorId, "partner.save", "Partner", result.id, { code: result.code, status: result.status }); return result;
    });
  }
  if (resource === "expenses") {
    const v = z.object({ category: z.string().min(1).max(80), amountMinor: minor.min(1), date: z.iso.date(), description: z.string().min(3).max(2000), attachment: z.string().regex(/^images\/[a-f0-9-]+\.webp$/).optional() }).parse(raw);
    return transaction(async tx => { const result = await tx.expense.create({ data: { ...v, date: new Date(`${v.date}T12:00:00+04:00`) } }); await audit(tx, actorId, "expense.record", "Expense", result.id); return result; });
  }
  if (resource === "settings") {
    const parsed = z.object({ settings: settingsSchema, rule: z.object({ amountMinor: minor, minimumOrderMinor: minor, holdDays: z.number().int().min(0).max(365), approvalPolicy: z.literal("MANUAL"), payoutFrequency: z.enum(["WEEKLY", "MONTHLY", "ON_REQUEST"]) }) }).parse(raw);
    return transaction(async tx => {
      const latest = await tx.commissionRule.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
      const rule = parsed.rule;
      if (latest.amountMinor !== rule.amountMinor || latest.minimumOrderMinor !== rule.minimumOrderMinor || latest.holdDays !== rule.holdDays || latest.approvalPolicy !== rule.approvalPolicy || latest.payoutFrequency !== rule.payoutFrequency) await tx.commissionRule.create({ data: rule });
      const settings = await tx.storeSettings.update({ where: { id: "store" }, data: parsed.settings });
      await audit(tx, actorId, "settings.save", "StoreSettings", "store", { brandName: settings.brandName }); return settings;
    });
  }
  if (resource === "customers") { const v = z.object({ id, notes: z.string().max(2000) }).parse(raw); return transaction(async tx => { const result = await tx.customer.update({ where: { id: v.id }, data: { notes: v.notes } }); await audit(tx, actorId, "customer.notes", "Customer", v.id); return result; }); }
  if (resource === "disputes") {
    const v = z.object({ id, status: z.enum(["RESOLVED", "REJECTED"]), resolution: z.string().min(5).max(2000) }).parse(raw);
    return transaction(async tx => {
      const dispute = await tx.referralDispute.findUniqueOrThrow({ where: { id: v.id }, include: { partner: true } });
      if (dispute.status !== "OPEN") throw new AppError("Müraciət artıq həll edilib.");
      const result = await tx.referralDispute.update({ where: { id: v.id }, data: { status: v.status, resolution: v.resolution, resolvedAt: new Date() } });
      await audit(tx, actorId, "dispute.resolve", "ReferralDispute", v.id, v);
      await tx.notification.create({ data: { audience: "PARTNER", userId: dispute.partner.userId, title: "Müraciət cavablandırıldı", body: "Nəticəyə müraciətlər bölməsində baxın." } }); return result;
    });
  }
  if (resource === "notifications") { const v = z.object({ id }).parse(raw); await db.notification.updateMany({ where: { id: v.id, audience: "ADMIN" }, data: { read: true } }); return { ok: true }; }
  if (resource === "integrations") { const v = z.object({ id }).parse(raw); return db.integrationSyncJob.update({ where: { id: v.id }, data: { status: "PENDING", nextRunAt: new Date() } }); }
  throw new AppError("Əməliyyat tapılmadı.", 404);
}
