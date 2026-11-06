import { publicSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { publicProductSelect } from "@/lib/catalog";
import { HomeLanding } from "@/components/home-landing";

export default async function Home() {
  const [settings, categories, featured, arrivals] = await Promise.all([
    publicSettings(),
    db.productCategory.findMany({
      where: { featured: true }, orderBy: { name: "asc" }, take: 8,
      select: {
        id: true, name: true, slug: true,
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
        products: {
          where: { status: "PUBLISHED", images: { some: {} } }, take: 1, orderBy: { createdAt: "desc" },
          select: { images: { take: 1, orderBy: { position: "asc" }, select: { key: true, alt: true } } },
        },
      },
    }),
    db.product.findMany({ where: { status: "PUBLISHED", featured: true }, select: publicProductSelect, take: 4, orderBy: { createdAt: "desc" } }),
    db.product.findMany({ where: { status: "PUBLISHED" }, select: publicProductSelect, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);
  return <HomeLanding settings={settings} categories={categories.map(c => ({
    id: c.id, name: c.name, slug: c.slug, productCount: c._count.products, image: c.products[0]?.images[0] ?? null,
  }))} featured={featured} arrivals={arrivals} />;
}
