import { freeDeliveryMessage } from "./delivery";
import { publicBrandImage } from "./public-brand-image";

export function conciseDescription(text: string, limit = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
}
export function homeSearchCopy(settings: { brandName: string; deliveryFreeRegions: string }) {
  return {
    title: `${settings.brandName} | Avtomobil aksesuarları və ətirləndiricilər`,
    description: conciseDescription([
      "Avtomobil ətirləndiriciləri, mikrofiber dəsmallar və qulluq məhsulları.",
      freeDeliveryMessage(settings.deliveryFreeRegions), "WhatsApp ilə rahat sifariş.",
    ].filter(Boolean).join(" ")),
  };
}

type BrandSettings = { brandName: string; domain: string; logoKey: string | null; faviconKey: string | null; instagram: string; tiktok: string };
export function homeSiteStructuredData(settings: BrandSettings) {
  const url = new URL("/", settings.domain).toString();
  const organizationId = new URL("#organization", url).toString();
  const logo = publicBrandImage(settings.logoKey || settings.faviconKey);
  const sameAs = [...new Set([settings.instagram, settings.tiktok].filter(value => {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }))];
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": organizationId, name: settings.brandName, url,
        ...(logo ? { logo: { "@type": "ImageObject", url: new URL(logo.url, url).toString(), ...(logo.width ? { width: logo.width, height: logo.height } : {}) } } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      { "@type": "WebSite", "@id": new URL("#website", url).toString(), name: settings.brandName, url, inLanguage: "az-AZ", publisher: { "@id": organizationId } },
    ],
  };
}
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
