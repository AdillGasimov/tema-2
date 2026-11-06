import { createHash } from "node:crypto";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";

const imageKey = z.string().regex(/^images\/[a-f0-9-]{36}\.webp$/);
const asset = z.object({ file: z.string().regex(/^[a-z0-9-]+\.png$/).max(100), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const brandReleaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(100), ownerMarker: z.string().min(1).max(180),
  expected: z.object({ brandName: z.string().min(2).max(80), domain: z.url(), logoKey: imageKey.nullable(), faviconKey: imageKey.nullable() }).strict(),
  brandName: z.string().trim().min(2).max(80), logo: asset, favicon: asset,
}).strict();
export type BrandRelease = z.infer<typeof brandReleaseSchema>;
export const brandReleaseHash = (plan: BrandRelease) => createHash("sha256").update(JSON.stringify(plan)).digest("hex");

async function inspect(tx: Pick<Tx, "auditLog" | "storeSettings">, plan: BrandRelease) {
  const receipt = await tx.auditLog.findUnique({ where: { id: `brand-release:${plan.id}` } });
  if (receipt) {
    if ((receipt.detail as { planHash?: string }).planHash !== brandReleaseHash(plan)) throw new AppError("Applied brand plan cannot be changed.", 409);
    return "applied" as const;
  }
  if (!await tx.auditLog.findUnique({ where: { id: plan.ownerMarker } })) return "unmatched" as const;
  const current = await tx.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  if ((Object.keys(plan.expected) as (keyof BrandRelease["expected"])[]).some(k => current[k] !== plan.expected[k])) throw new AppError("Brand settings changed since preview; owner review is required.", 409);
  return current;
}
export async function inspectBrandRelease(raw: unknown) {
  const state = await inspect(db, brandReleaseSchema.parse(raw));
  return typeof state === "string" ? state : "ready";
}
export async function applyBrandRelease(raw: unknown, images: { logoKey: string; faviconKey: string }) {
  const plan = brandReleaseSchema.parse(raw);
  const uploaded = z.object({ logoKey: imageKey, faviconKey: imageKey }).strict().parse(images);
  return transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(873194633)`;
    const before = await inspect(tx, plan);
    if (typeof before === "string") return { applied: false, reason: before };
    await tx.storeSettings.update({ where: { id: "store" }, data: { brandName: plan.brandName, ...uploaded } });
    await tx.auditLog.create({ data: { id: `brand-release:${plan.id}`, actorId: "system:owner-brand-release", action: "settings.brand", entity: "StoreSettings", entityId: "store",
      detail: { planId: plan.id, planHash: brandReleaseHash(plan), before: plan.expected, after: { brandName: plan.brandName, ...uploaded } } } });
    return { applied: true, reason: "applied" };
  });
}
