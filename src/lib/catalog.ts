import { Prisma } from "@prisma/client";
import { db } from "./db";
import { toMinor } from "./money";
import { AppError } from "./errors";
export const publicProductSelect = {
  id: true, name: true, slug: true, description: true, featured: true, seoTitle: true, seoDescription: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { id: true, key: true, alt: true, position: true }, orderBy: { position: "asc" as const } },
  variants: { where: { active: true }, select: { id: true, name: true, sku: true, priceMinor: true, discountMinor: true, stock: true, reserved: true } },
} satisfies Prisma.ProductSelect;
export async function catalog(query: URLSearchParams) {
  const page = Math.max(1, Math.min(10000, Number(query.get("page")) || 1));
  const category = query.get("category") || undefined;
  const search = (query.get("q") || "").slice(0, 150);
  let min = 0, max = 100000000;
  try { if (query.get("min")) min = toMinor(query.get("min")!); if (query.get("max")) max = toMinor(query.get("max")!); }
  catch { throw new AppError("Qiymət filtrini yoxlayın."); }
  if (max < min) throw new AppError("Maksimum qiymət minimumdan az ola bilməz.");
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED", ...(category ? { category: { slug: category } } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
    variants: { some: { active: true, OR: [{ discountMinor: { gte: min, lte: max } }, { discountMinor: null, priceMinor: { gte: min, lte: max } }] } },
  };
  // Price sort must happen before pagination, across the whole matching catalog.
  if (["price-asc", "price-desc"].includes(query.get("sort") ?? "")) {
    const all = await db.product.findMany({ where, select: publicProductSelect });
    const price = (p: typeof all[number]) => Math.min(...p.variants.map(v => v.discountMinor ?? v.priceMinor));
    all.sort((a, b) => (price(a) - price(b)) * (query.get("sort") === "price-desc" ? -1 : 1));
    return { products: all.slice((page - 1) * 12, page * 12), total: all.length, page };
  }
  const [products, total] = await Promise.all([
    db.product.findMany({ where, select: publicProductSelect, skip: (page - 1) * 12, take: 12, orderBy: query.get("sort") === "name" ? { name: "asc" } : { createdAt: "desc" } }),
    db.product.count({ where }),
  ]);
  return { products, total, page };
}
export type PublicProduct = Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>;
