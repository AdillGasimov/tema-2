import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export default async function sitemap() { const s = await getSettings(); const products = await db.product.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }); return [{ url: s.domain }, { url: `${s.domain}/products` }, ...products.map(p => ({ url: `${s.domain}/products/${p.slug}`, lastModified: p.updatedAt }))]; }
