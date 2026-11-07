import { db } from "./db";
import { cache } from "react";
// Request-scoped memoization shares ORM reads between metadata/layout/page.
// A new request still reads fresh settings after an administrator saves them.
export const getSettings = cache(async function getSettings() {
  return db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
});
export const publicSettings = cache(async function publicSettings() {
  const s = await getSettings();
  // Do not spread this object: future private integration settings must stay server-side.
  return { brandName: s.brandName, domain: s.domain, description: s.description, logoKey: s.logoKey, faviconKey: s.faviconKey,
    legalName: s.legalName, taxId: s.taxId, businessAddress: s.businessAddress,
    primaryColor: s.primaryColor, backgroundColor: s.backgroundColor, whatsapp: s.whatsapp, phone: s.phone, email: s.email,
    instagram: s.instagram, tiktok: s.tiktok, socialLinks: s.socialLinks, announcement: s.announcement, heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle, heroImageKey: s.heroImageKey, deliveryInfo: s.deliveryInfo, deliveryRegions: s.deliveryRegions,
    deliveryTime: s.deliveryTime, deliveryFreeRegions: s.deliveryFreeRegions,
    deliveryFeeMinor: s.deliveryFeeMinor, freeDeliveryMinor: s.freeDeliveryMinor, showFeatured: s.showFeatured,
    showNewArrivals: s.showNewArrivals, showCategories: s.showCategories };
});
