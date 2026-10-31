import { db } from "./db";
export async function getSettings() {
  return db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
}
export async function publicSettings() {
  const s = await getSettings();
  // Do not spread this object: future private integration settings must stay server-side.
  return { brandName: s.brandName, domain: s.domain, description: s.description, logoKey: s.logoKey, faviconKey: s.faviconKey,
    primaryColor: s.primaryColor, backgroundColor: s.backgroundColor, whatsapp: s.whatsapp, phone: s.phone, email: s.email,
    instagram: s.instagram, tiktok: s.tiktok, socialLinks: s.socialLinks, announcement: s.announcement, heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle, heroImageKey: s.heroImageKey, deliveryInfo: s.deliveryInfo, deliveryRegions: s.deliveryRegions,
    deliveryFeeMinor: s.deliveryFeeMinor, freeDeliveryMinor: s.freeDeliveryMinor, showFeatured: s.showFeatured,
    showNewArrivals: s.showNewArrivals, showCategories: s.showCategories };
}
