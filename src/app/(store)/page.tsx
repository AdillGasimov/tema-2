import { publicSettings } from "@/lib/settings";
import { homeCategories, homeCollections } from "@/lib/storefront-read";
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
  const [settings, categories, { featured, arrivals }] = await Promise.all([
    publicSettings(), homeCategories(), homeCollections(),
  ]);
  return <HomeLanding settings={settings} categories={categories} featured={featured} arrivals={arrivals} />;
}
