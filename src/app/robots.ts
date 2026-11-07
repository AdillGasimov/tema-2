import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  return { rules: [{ userAgent: "*", allow: ["/", "/api/media/"], disallow: ["/admin", "/partner$", "/partner/", "/account", "/api/", "/checkout", "/cart", "/login"] }], sitemap: new URL("/sitemap.xml", s.domain).toString() };
}
