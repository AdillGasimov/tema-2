import type { Metadata } from "next";
import { CartProvider } from "@/components/cart-provider";
import { publicSettings } from "@/lib/settings";
import "./globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const s = await publicSettings();
  return { title: { default: s.brandName, template: `%s | ${s.brandName}` }, description: s.description,
    metadataBase: new URL(s.domain), openGraph: { title: s.brandName, description: s.description, locale: "az_AZ", type: "website", ...(s.heroImageKey ? { images: [`/api/media/${s.heroImageKey}`] } : {}) },
    ...(s.faviconKey ? { icons: { icon: `/api/media/${s.faviconKey}` } } : {}) };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await publicSettings();
  return <html lang="az"><body style={{ "--brand": s.primaryColor, "--ink": s.backgroundColor } as React.CSSProperties}><CartProvider>{children}</CartProvider></body></html>;
}
