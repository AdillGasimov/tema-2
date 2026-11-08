import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { lockProductSlugs } from "./product-slugs";
import { allocateStoreSkus } from "./store-skus";

export const catalogReviewPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(100), ownerMarker: z.string().min(1).max(180),
  variants: z.array(z.object({ id: z.string().min(1).max(100), productId: z.string().min(1).max(100), sourceSku: z.string().min(1).max(80) }).strict()).min(1).max(1000),
  price: z.object({ productId: z.string().min(1), variantId: z.string().min(1), expectedMinor: z.number().int().positive(), minor: z.number().int().positive().max(100000000) }).strict(),
  delivery: z.object({ expectedInfo: z.string().max(1000), info: z.literal("") }).strict(),
  // Retained in historic plan hashes; the retired review no longer changes status.
  rights: z.array(z.object({ id: z.string().min(1), slug: z.string().min(1), imageKeys: z.array(z.string().min(1)).max(12) }).strict()).max(50),
}).strict().superRefine((plan, ctx) => {
  if (new Set(plan.variants.map(v => v.id)).size !== plan.variants.length || new Set(plan.rights.map(p => p.id)).size !== plan.rights.length) ctx.addIssue({ code: "custom", message: "Duplicate product or variant." });
  if (!plan.variants.some(v => v.id === plan.price.variantId && v.productId === plan.price.productId)) ctx.addIssue({ code: "custom", message: "Price variant is outside the reviewed scope." });
});
export type CatalogReviewPlan = z.infer<typeof catalogReviewPlanSchema>;
const hash = (p: CatalogReviewPlan) => createHash("sha256").update(JSON.stringify(p)).digest("hex");
type Reader = Pick<Tx, "auditLog" | "productVariant" | "storeSettings">;
async function inspect(reader: Reader, p: CatalogReviewPlan) {
  const receipt = await reader.auditLog.findUnique({ where: { id: `catalog-review:${p.id}` } });
  if (receipt) {
    if ((receipt.detail as { hash?: string }).hash !== hash(p)) throw new AppError("Applied catalog review plan cannot be changed.", 409);
    return "applied" as const;
  }
  if (!await reader.auditLog.findUnique({ where: { id: p.ownerMarker } })) return "unmatched" as const;
  const variants = await reader.productVariant.findMany({ where: { id: { in: p.variants.map(v => v.id) } } });
  for (const expected of p.variants) {
    const v = variants.find(v => v.id === expected.id);
    if (!v || v.productId !== expected.productId || v.sku !== expected.sourceSku) throw new AppError(`Reviewed variant changed: ${expected.id}.`, 409);
  }
  const price = variants.find(v => v.id === p.price.variantId)!;
  if (price.discountMinor !== null || ![p.price.expectedMinor, p.price.minor].includes(price.priceMinor)) throw new AppError("Sunshade price changed since owner review.", 409);
  const settings = await reader.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  if (![p.delivery.expectedInfo, p.delivery.info].includes(settings.deliveryInfo)) throw new AppError("Delivery note changed since owner review.", 409);
  return { variants, price, settings };
}
export async function inspectCatalogReview(raw: unknown) { const result = await inspect(db, catalogReviewPlanSchema.parse(raw)); return typeof result === "string" ? result : "ready"; }
export async function applyCatalogReview(raw: unknown) {
  const p = catalogReviewPlanSchema.parse(raw);
  return transaction(async tx => {
    await lockProductSlugs(tx);
    const state = await inspect(tx, p);
    if (typeof state === "string") return { applied: false, reason: state };
    const missing = p.variants.filter(v => !state.variants.find(actual => actual.id === v.id)!.storeSku);
    const codes = missing.length ? await allocateStoreSkus(tx, missing.length) : [];
    for (const [n, v] of missing.entries()) {
      await tx.productVariant.update({ where: { id: v.id }, data: { storeSku: codes[n] } });
      await tx.auditLog.create({ data: { actorId: "system:owner-catalog-review", action: "variant.store-sku", entity: "Variant", entityId: v.id, detail: { planId: p.id, storeSku: codes[n], sourceSku: v.sourceSku } } });
    }
    await tx.productVariant.update({ where: { id: p.price.variantId }, data: { priceMinor: p.price.minor } });
    await tx.product.update({ where: { id: p.price.productId }, data: { needsPriceReview: false } });
    await tx.auditLog.create({ data: { actorId: "system:owner-catalog-review", action: "variant.owner-price", entity: "Variant", entityId: p.price.variantId, detail: { planId: p.id, before: state.price.priceMinor, after: p.price.minor } } });
    await tx.storeSettings.update({ where: { id: "store" }, data: { deliveryInfo: p.delivery.info } });
    await tx.auditLog.create({ data: { actorId: "system:owner-catalog-review", action: "settings.delivery-note", entity: "StoreSettings", entityId: "store", detail: { planId: p.id, before: state.settings.deliveryInfo, after: p.delivery.info } } });
    await tx.auditLog.create({ data: { id: `catalog-review:${p.id}`, actorId: "system:owner-catalog-review", action: "catalog.owner-review", entity: "CatalogReview", entityId: p.id, detail: { hash: hash(p), assigned: missing.length, price: p.price.minor, rightsProducts: [], reviewRemoved: true } } });
    return { applied: true, reason: "applied" };
  });
}
