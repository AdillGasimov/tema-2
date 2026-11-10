import { Prisma } from "@prisma/client";
import { db } from "./db";
import { toMinor } from "./money";
import { AppError } from "./errors";
import { cache } from "react";

// Share the identical navigation/filter read within one render, never across
// requests: category edits and all product/stock/price reads stay current.
export const storefrontCategories = cache(() => db.productCategory.findMany({ orderBy: { name: "asc" } }));
export const publicProductSelect = {
  id: true, name: true, slug: true, description: true, shortDescription: true, featured: true, seoTitle: true, seoDescription: true,
  category: { select: { id: true, name: true, slug: true } },
  images: { select: { id: true, key: true, alt: true, position: true }, orderBy: { position: "asc" as const } },
  variants: { where: { active: true }, select: { id: true, name: true, storeSku: true, priceMinor: true, discountMinor: true, stock: true, stockVerified: true, reserved: true } },
} satisfies Prisma.ProductSelect;
export type PublicProduct = Prisma.ProductGetPayload<{ select: typeof publicProductSelect }>;
export async function catalog(query: URLSearchParams) {
  const requested = Number(query.get("page"));
  const requestedPage = Number.isSafeInteger(requested) && requested > 0 ? Math.min(10000, requested) : 1;
  const category = query.get("category") || undefined;
  const search = (query.get("q") || "").slice(0, 150);
  let min = 0, max = 100000000;
  try { if (query.get("min")) min = toMinor(query.get("min")!); if (query.get("max")) max = toMinor(query.get("max")!); }
  catch { throw new AppError("Qiymət filtrini yoxlayın."); }
  if (max < min) throw new AppError("Maksimum qiymət minimumdan az ola bilməz.");
  const effectivePrice = (v: PublicProduct["variants"][number]) => v.discountMinor ?? v.priceMinor;
  const display = (p: PublicProduct): PublicProduct => ({ ...p, variants: p.variants.filter(v => effectivePrice(v) >= min && effectivePrice(v) <= max) });
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED", ...(category ? { category: { slug: category } } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }, { shortDescription: { contains: search, mode: "insensitive" } }] } : {}),
    variants: { some: { active: true, OR: [{ discountMinor: { gte: min, lte: max } }, { discountMinor: null, priceMinor: { gte: min, lte: max } }] } },
  };
  const sort = query.get("sort");
  if (["price-asc", "price-desc", "name"].includes(sort ?? "")) {
    const all = (await db.product.findMany({ where, select: publicProductSelect })).map(display);
    const price = (p: PublicProduct) => Math.min(...p.variants.map(effectivePrice));
    const collator = new Intl.Collator("az", { sensitivity: "base", numeric: true });
    all.sort((a, b) => (sort === "name" ? collator.compare(a.name, b.name) : (price(a) - price(b)) * (sort === "price-desc" ? -1 : 1)) || a.id.localeCompare(b.id));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(all.length / 12)));
    return { products: all.slice((page - 1) * 12, page * 12), total: all.length, page };
  }
  const total = await db.product.count({ where });
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 12)));
  const products = await db.product.findMany({ where, select: publicProductSelect, skip: (page - 1) * 12, take: 12, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
  return { products: products.map(display), total, page };
}
