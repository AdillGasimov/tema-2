import type { Metadata } from "next";
import { publicSettings } from "./settings";

export async function pageMetadata(title: string, description: string, path: string, noIndex = false): Promise<Metadata> {
  const s = await publicSettings();
  const url = new URL(path, s.domain).toString();
  const fullTitle = `${title} | ${s.brandName}`;
  return { title, description, alternates: { canonical: url }, ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: fullTitle, description, url, siteName: s.brandName, locale: "az_AZ", type: "website" } };
}
export function conciseDescription(text: string, limit = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return clean.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
}
