import type { Metadata } from "next";
import { publicSettings } from "./settings";
export { conciseDescription } from "./search-appearance";

export async function pageMetadata(title: string, description: string, path: string, noIndex = false): Promise<Metadata> {
  const s = await publicSettings();
  const url = new URL(path, s.domain).toString();
  const fullTitle = `${title} | ${s.brandName}`;
  return { title, description, alternates: { canonical: url }, ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: fullTitle, description, url, siteName: s.brandName, locale: "az_AZ", type: "website" } };
}
