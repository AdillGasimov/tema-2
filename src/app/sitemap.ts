import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, products, categories] = await Promise.all([getSettings(), db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }), db.productCategory.findMany({ where: { products: { some: { status: "PUBLISHED" } } }, select: { slug: true } })]);
  const url = (path: string) => new URL(path, s.domain).toString();
  return [...["/", "/products", "/privacy", "/terms", "/returns", "/partnership"].map(path => ({ url: url(path) })),
    ...categories.map(c => ({ url: url(`/products?category=${encodeURIComponent(c.slug)}`) })),
    ...products.map(p => ({ url: url(`/products/${p.slug}`), lastModified: p.updatedAt }))];
}
