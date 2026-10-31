import { getSettings } from "@/lib/settings";
export const dynamic = "force-dynamic";
export default async function robots() { const s = await getSettings(); return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/partner", "/api", "/checkout", "/login"] }], sitemap: `${s.domain}/sitemap.xml` }; }
