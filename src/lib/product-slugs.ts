import type { Tx } from "./db";
import { AppError } from "./errors";

export async function lockProductSlugs(tx: Tx) {
  // One namespace spans current URLs and retained URLs, including draft/deleted records.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(873194635)`;
}
export async function assertProductSlugAvailable(tx: Pick<Tx, "product" | "productSlugAlias">, slug: string, productId?: string) {
  const current = await tx.product.findUnique({ where: { slug }, select: { id: true } });
  const alias = await tx.productSlugAlias.findUnique({ where: { oldSlug: slug }, select: { productId: true } });
  if ((current && current.id !== productId) || (alias && alias.productId !== productId)) {
    throw new AppError("Bu URL adı mövcud və ya əvvəlki məhsul ünvanı üçün saxlanılıb. Başqa qısa URL adı seçin.", 409);
  }
}
export async function retainProductSlug(tx: Tx, productId: string, oldSlug: string) {
  const previous = await tx.productSlugAlias.findUnique({ where: { oldSlug } });
  if (previous && previous.productId !== productId) throw new AppError("Əvvəlki məhsul ünvanı başqa məhsula aiddir.", 409);
  if (!previous) await tx.productSlugAlias.create({ data: { oldSlug, productId } });
}
