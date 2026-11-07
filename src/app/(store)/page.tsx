import { publicSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { publicProductSelect } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { HomeLanding } from "@/components/home-landing";

export async function generateMetadata() {
  const s = await publicSettings();
  const title = "Avtomobil aksesuarları və qulluq məhsulları";
  const description = `${s.brandName}: avtomobil ətirləndiriciləri, mikrofiber dəsmallar və qulluq aksesuarları. Məhsulları seçin, sifarişi WhatsApp vasitəsilə təsdiqləyin.`;
  const metadata = await pageMetadata(title, description, "/");
  const image = s.heroImageKey ? { url: `/api/media/${s.heroImageKey}`, alt: s.brandName } : { url: "/images/storefront/hero-og.jpg", width: 1200, height: 675, alt: `${s.brandName} avtomobil aksesuarları` };
  return { ...metadata, openGraph: { ...metadata.openGraph, images: [image] }, twitter: { card: "summary_large_image" as const, title: `${title} | ${s.brandName}`, description, images: [image.url] } };
}

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
