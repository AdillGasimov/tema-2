import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { assertProductSlugAvailable, lockProductSlugs, retainProductSlug } from "./product-slugs";
const metadata = z.object({ name: z.string().min(2).max(160), slug: z.string().regex(/^[a-z0-9-]+$/).max(180), description: z.string().max(10000), shortDescription: z.string().max(500), seoTitle: z.string().max(180).nullable(), seoDescription: z.string().max(300).nullable() }).strict();
const delivery = z.object({ deliveryInfo: z.string().max(1000), deliveryRegions: z.string().min(1).max(1000), deliveryTime: z.string().max(500), deliveryFreeRegions: z.string().max(1000), deliveryFeeMinor: z.number().int().min(0).max(100000000), freeDeliveryMinor: z.number().int().min(0).max(100000000) }).strict();
export const storeContentPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(100), ownerMarker: z.string().min(1).max(180),
  products: z.array(z.object({ id: z.string().min(1).max(100), expected: metadata, after: metadata,
    images: z.array(z.object({ id: z.string().min(1).max(100), key: z.string().regex(/^images\/[a-f0-9-]{36}\.webp$/), expectedAlt: z.string().max(1000), alt: z.string().max(500) }).strict()).max(12),
    priceReview: z.object({ sku: z.string().min(1).max(80), expectedMinor: z.number().int().min(1).max(100000000) }).strict().optional(),
  }).strict()).min(1).max(200),
  delivery: z.object({ expected: delivery, after: delivery }).strict(),
}).strict().superRefine((plan, ctx) => {
  if (new Set(plan.products.map(p => p.id)).size !== plan.products.length || new Set(plan.products.map(p => p.after.slug)).size !== plan.products.length) ctx.addIssue({ code: "custom", message: "Product IDs and target slugs must be unique." });
});
export type StoreContentPlan = z.infer<typeof storeContentPlanSchema>;
export const storeContentHash = (plan: StoreContentPlan) => createHash("sha256").update(JSON.stringify(plan)).digest("hex");
const fields = ["name", "slug", "description", "shortDescription", "seoTitle", "seoDescription"] as const;
type Reader = Pick<Tx, "auditLog" | "product" | "productSlugAlias" | "storeSettings">;
async function inspect(reader: Reader, plan: StoreContentPlan) {
  const receipt = await reader.auditLog.findUnique({ where: { id: `store-content:${plan.id}` } });
  if (receipt) {
    if ((receipt.detail as { planHash?: string }).planHash !== storeContentHash(plan)) throw new AppError("Applied content plan cannot be changed.", 409);
    return "applied" as const;
  }
  if (!await reader.auditLog.findUnique({ where: { id: plan.ownerMarker } })) return "unmatched" as const;
  const current = await reader.product.findMany({ where: { id: { in: plan.products.map(p => p.id) } }, include: { images: true, variants: true } });
  for (const item of plan.products) {
    const product = current.find(p => p.id === item.id);
    if (!product || product.status !== "PUBLISHED" || fields.some(k => product[k] !== item.expected[k] && product[k] !== item.after[k])) throw new AppError(`Product metadata changed since review: ${item.id}.`, 409);
    for (const image of item.images) {
      const actual = product.images.find(i => i.id === image.id && i.key === image.key);
      if (!actual || (actual.alt !== image.expectedAlt && actual.alt !== image.alt)) throw new AppError(`Product image text changed since review: ${item.id}.`, 409);
    }
    await assertProductSlugAvailable(reader, item.after.slug, item.id);
    await assertProductSlugAvailable(reader, item.expected.slug, item.id);
  }
  const settings = await reader.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  for (const key of Object.keys(plan.delivery.expected) as (keyof StoreContentPlan["delivery"]["expected"])[]) {
    if (settings[key] !== plan.delivery.expected[key] && settings[key] !== plan.delivery.after[key]) throw new AppError(`Delivery setting changed since review: ${key}.`, 409);
  }
  return { current, settings };
}
export async function inspectStoreContent(raw: unknown) {
  const state = await inspect(db, storeContentPlanSchema.parse(raw));
  return typeof state === "string" ? state : "ready";
}
export async function applyStoreContent(raw: unknown) {
  const plan = storeContentPlanSchema.parse(raw);
  return transaction(async tx => {
    await lockProductSlugs(tx);
    const state = await inspect(tx, plan);
    if (typeof state === "string") return { applied: false, reason: state };
    for (const item of plan.products) {
      const previous = state.current.find(p => p.id === item.id)!;
      const flag = item.priceReview && previous.variants.some(v => v.sku === item.priceReview!.sku && (v.discountMinor ?? v.priceMinor) === item.priceReview!.expectedMinor);
      await tx.product.update({ where: { id: item.id }, data: { ...item.after, ...(flag ? { needsPriceReview: true } : {}) } });
      if (item.expected.slug !== item.after.slug) await retainProductSlug(tx, item.id, item.expected.slug);
      for (const image of item.images) await tx.productImage.updateMany({ where: { id: image.id, productId: item.id, key: image.key }, data: { alt: image.alt } });
      await tx.auditLog.create({ data: { actorId: "system:owner-store-content", action: "product.presentation", entity: "Product", entityId: item.id,
        detail: { planId: plan.id, before: Object.fromEntries(fields.map(k => [k, previous[k]])), after: item.after, previousSlug: item.expected.slug, priceReviewFlagged: Boolean(flag) } } });
    }
    await tx.storeSettings.update({ where: { id: "store" }, data: plan.delivery.after });
    await tx.auditLog.create({ data: { actorId: "system:owner-store-content", action: "settings.delivery", entity: "StoreSettings", entityId: "store",
      detail: { planId: plan.id, before: Object.fromEntries(Object.keys(plan.delivery.expected).map(k => [k, state.settings[k as keyof typeof state.settings]])), after: plan.delivery.after } } });
    await tx.auditLog.create({ data: { id: `store-content:${plan.id}`, actorId: "system:owner-store-content", action: "store.content-release", entity: "StoreContentRelease", entityId: plan.id,
      detail: { planHash: storeContentHash(plan), productCount: plan.products.length } } });
    return { applied: true, reason: "applied" };
  });
}
