import { publicSettings } from "@/lib/settings";
import { homeCategories, homeCollections } from "@/lib/storefront-read";
import { pageMetadata } from "@/lib/seo";
import { HomeLanding } from "@/components/home-landing";
import { homeSearchCopy, homeSiteStructuredData, serializeJsonLd } from "@/lib/search-appearance";

export async function generateMetadata() {
  const s = await publicSettings();
  const { title, description } = homeSearchCopy(s);
  const metadata = await pageMetadata("Avtomobil aksesuarları və ətirləndiricilər", description, "/");
  const image = s.heroImageKey ? { url: `/api/media/${s.heroImageKey}`, alt: s.brandName } : { url: "/images/storefront/hero-og.jpg", width: 1200, height: 675, alt: `${s.brandName} avtomobil aksesuarları` };
  return { ...metadata, title: { absolute: title }, openGraph: { ...metadata.openGraph, title, images: [image] }, twitter: { card: "summary_large_image" as const, title, description, images: [image.url] } };
}

export default async function Home() {
  const [settings, categories, { featured, arrivals }] = await Promise.all([
    publicSettings(), homeCategories(), homeCollections(),
  ]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeSiteStructuredData(settings)) }} /><HomeLanding settings={settings} categories={categories} featured={featured} arrivals={arrivals} /></>;
}
