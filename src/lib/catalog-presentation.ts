import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { setProductCover } from "./product-image-order";

const key = z.string().regex(/^images\/[a-f0-9-]{36}\.webp$/);
const itemSchema = z.object({
  id: z.string().min(1).max(120), expectedName: z.string().min(2).max(160), expectedCategoryId: z.string().min(1).max(120),
  expectedImageKeys: z.array(key).min(1).max(12), name: z.string().trim().min(2).max(160), categorySlug: z.string().regex(/^[a-z0-9-]+$/),
  coverKey: key,
  coverAsset: z.object({ file: z.string().regex(/^[a-z0-9-]+\.png$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
}).strict().refine(i => i.expectedImageKeys.includes(i.coverKey), { message: "Cover must belong to the captured product." });
export const catalogPresentationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(100),
  categories: z.array(z.object({ name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]+$/).max(160) }).strict()).min(1).max(8),
  items: z.array(itemSchema).min(1).max(30),
}).strict().refine(p => new Set(p.items.map(i => i.id)).size === p.items.length && new Set(p.categories.map(c => c.slug)).size === p.categories.length && p.items.every(i => p.categories.some(c => c.slug === i.categorySlug)), { message: "The catalog plan must have unique products and known categories." });
export type CatalogPresentation = z.infer<typeof catalogPresentationSchema>;
export const catalogPresentationHash = (plan: CatalogPresentation) => createHash("sha256").update(JSON.stringify(plan)).digest("hex");

async function inspect(tx: Pick<Tx, "auditLog" | "product" | "productCategory">, plan: CatalogPresentation) {
  const receipt = await tx.auditLog.findUnique({ where: { id: `catalog-presentation:${plan.id}` } });
  if (receipt) {
    if ((receipt.detail as { planHash?: string }).planHash !== catalogPresentationHash(plan)) throw new AppError("Applied catalog plan cannot be changed.", 409);
    return "applied" as const;
  }
  const products = await tx.product.findMany({ where: { id: { in: plan.items.map(i => i.id) } }, include: { images: { orderBy: [{ position: "asc" }, { id: "asc" }] } } });
  // Other installations do not contain the owner's captured products.
  if (!products.length) return "unmatched" as const;
  const conflicts = plan.items.filter(item => {
    const p = products.find(p => p.id === item.id);
    return !p || p.status !== "PUBLISHED" || p.name !== item.expectedName || p.categoryId !== item.expectedCategoryId || JSON.stringify(p.images.map(i => i.key)) !== JSON.stringify(item.expectedImageKeys);
  });
  if (conflicts.length) throw new AppError(`Catalog changed since preview; review these product IDs: ${conflicts.map(i => i.id).join(", ")}`, 409);
  for (const category of plan.categories) {
    const existing = await tx.productCategory.findUnique({ where: { slug: category.slug } });
    if (existing && existing.name !== category.name) throw new AppError(`Category changed since preview: ${category.slug}`, 409);
  }
  return products;
}
export async function inspectCatalogPresentation(raw: unknown) {
  const plan = catalogPresentationSchema.parse(raw);
  const state = await inspect(db, plan);
  return typeof state === "string" ? state : "ready";
}
export async function applyCatalogPresentation(raw: unknown, uploaded: ReadonlyMap<string, string> = new Map()) {
  const plan = catalogPresentationSchema.parse(raw);
  for (const item of plan.items) if (item.coverAsset && !key.safeParse(uploaded.get(item.id)).success) throw new AppError("Prepared cover is missing.");
  return transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(873194629)`;
    const products = await inspect(tx, plan);
    if (typeof products === "string") return { applied: false, reason: products, count: 0 };
    const categories = new Map<string, string>();
    for (const c of plan.categories) categories.set(c.slug, (await tx.productCategory.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, featured: true } })).id);
    for (const item of plan.items) {
      const before = products.find(p => p.id === item.id)!;
      let cover = item.coverKey;
      if (item.coverAsset) {
        cover = uploaded.get(item.id)!;
        if (before.images.length < 12) await tx.productImage.create({ data: { productId: item.id, key: cover, alt: item.name, position: before.images.length } });
        else {
          // Keep the immutable original object and its key in the audit history.
          // Replace one gallery reference rather than exceeding the photo limit.
          await tx.productImage.update({ where: { id: before.images.find(i => i.key === item.coverKey)!.id }, data: { key: cover, alt: item.name } });
        }
      }
      await tx.product.update({ where: { id: item.id }, data: { name: item.name, categoryId: categories.get(item.categorySlug)! } });
      await tx.productImage.updateMany({ where: { productId: item.id, alt: item.expectedName }, data: { alt: item.name } });
      await setProductCover(tx, item.id, cover);
      await tx.auditLog.create({ data: { actorId: "system:owner-catalog-presentation", action: "product.presentation", entity: "Product", entityId: item.id,
        detail: { planId: plan.id, previousName: before.name, name: item.name, previousCategoryId: before.categoryId, categoryId: categories.get(item.categorySlug)!, previousImages: before.images.map(i => ({ id: i.id, key: i.key, alt: i.alt, position: i.position })), coverKey: cover } } });
    }
    await tx.auditLog.create({ data: { id: `catalog-presentation:${plan.id}`, actorId: "system:owner-catalog-presentation", action: "catalog.presentation.apply", entity: "CatalogPresentation", entityId: plan.id, detail: { planHash: catalogPresentationHash(plan), count: plan.items.length } } });
    return { applied: true, reason: "applied", count: plan.items.length };
  });
}
