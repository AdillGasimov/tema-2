import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { freeDeliveryMessage } from "./delivery";
import { lockProductSlugs } from "./product-slugs";

export const storefrontAvailabilityPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(100),
  ownerMarker: z.string().min(1).max(180),
  ownerConfirmedAtLeastOne: z.literal(true),
  settings: z.object({ announcement: z.string().max(2000), deliveryFreeRegions: z.string().min(1).max(1000), deliveryFeeMinor: z.number().int().min(0).max(100000000) }).strict(),
  variants: z.array(z.object({ id: z.string().min(1).max(100), productId: z.string().min(1).max(100), storeSku: z.string().regex(/^FC-\d{4,}$/) }).strict()).min(1).max(1000),
}).strict().refine(p => new Set(p.variants.map(v => v.id)).size === p.variants.length, "Duplicate variant.")
  .refine(p => !!freeDeliveryMessage(p.settings.deliveryFreeRegions), "Free delivery destination is missing.");
export type StorefrontAvailabilityPlan = z.infer<typeof storefrontAvailabilityPlanSchema>;
const hash = (p: StorefrontAvailabilityPlan) => createHash("sha256").update(JSON.stringify(p)).digest("hex");
type Reader = Pick<Tx, "auditLog" | "productVariant" | "storeSettings">;
async function inspect(reader: Reader, p: StorefrontAvailabilityPlan) {
  const receipt = await reader.auditLog.findUnique({ where: { id: `storefront-availability:${p.id}` } });
  if (receipt) {
    if ((receipt.detail as { hash?: string }).hash !== hash(p)) throw new AppError("Applied storefront availability plan cannot be changed.", 409);
    return "applied" as const;
  }
  if (!await reader.auditLog.findUnique({ where: { id: p.ownerMarker } })) return "unmatched" as const;
  const announcement = freeDeliveryMessage(p.settings.deliveryFreeRegions)!;
  const settings = await reader.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  if (![p.settings.announcement, announcement].includes(settings.announcement) || settings.deliveryFreeRegions !== p.settings.deliveryFreeRegions || settings.deliveryFeeMinor !== p.settings.deliveryFeeMinor) throw new AppError("Delivery settings changed since owner confirmation.", 409);
  const variants = await reader.productVariant.findMany({ where: { id: { in: p.variants.map(v => v.id) } }, include: { product: { select: { status: true, rightsReviewRequired: true } } } });
  for (const expected of p.variants) {
    const v = variants.find(v => v.id === expected.id);
    if (!v || v.productId !== expected.productId || v.storeSku !== expected.storeSku || !v.active || v.product.status !== "PUBLISHED" || v.product.rightsReviewRequired) throw new AppError(`Confirmed product changed: ${expected.id}.`, 409);
    if (v.stock <= v.reserved) throw new AppError(`Confirmed product has no available recorded stock: ${expected.storeSku}.`, 409);
  }
  return { settings, variants, announcement };
}
export async function inspectStorefrontAvailability(raw: unknown) {
  const state = await inspect(db, storefrontAvailabilityPlanSchema.parse(raw));
  return typeof state === "string" ? state : "ready";
}
export async function applyStorefrontAvailability(raw: unknown) {
  const p = storefrontAvailabilityPlanSchema.parse(raw);
  return transaction(async tx => {
    await lockProductSlugs(tx);
    const state = await inspect(tx, p);
    if (typeof state === "string") return { applied: false, reason: state };
    const actorId = "system:owner-stock-confirmation";
    for (const v of state.variants) {
      await tx.productVariant.update({ where: { id: v.id }, data: { stockVerified: true } });
      await tx.auditLog.create({ data: { actorId, action: "inventory.adjust", entity: "Variant", entityId: v.id, detail: {
        planId: p.id, delta: 0, stockVerified: true, recordedStock: v.stock, reserved: v.reserved,
        reason: "Mağaza sahibi bu satış məhsulundan ən azı 1 ədədin fiziki stokda olduğunu təsdiqlədi. Qeydə alınmış say dəyişdirilmədi.",
      } } });
    }
    await tx.storeSettings.update({ where: { id: "store" }, data: { announcement: state.announcement } });
    await tx.auditLog.create({ data: { actorId, action: "settings.delivery-announcement", entity: "StoreSettings", entityId: "store", detail: { planId: p.id, before: state.settings.announcement, after: state.announcement } } });
    await tx.auditLog.create({ data: { id: `storefront-availability:${p.id}`, actorId, action: "storefront.owner-availability", entity: "StorefrontAvailability", entityId: p.id, detail: { hash: hash(p), verifiedVariants: p.variants.map(v => v.id) } } });
    return { applied: true, reason: "applied" };
  });
}
