import Image from "next/image";
import { Sparkles } from "lucide-react";

type BrandIdentity = { brandName: string; logoKey?: string | null; faviconKey?: string | null; dark?: boolean };

export function BrandLogo({ brandName, logoKey, faviconKey, dark = false }: BrandIdentity) {
  if (logoKey && (!dark || !faviconKey)) return <Image src={`/api/media/${logoKey}`} alt={brandName} width={220} height={74} className={`brand-logo${dark ? " brand-logo-light-panel" : ""}`} unoptimized />;
  return <>
    {faviconKey ? <Image src={`/api/media/${faviconKey}`} alt="" aria-hidden="true" width={44} height={44} className="brand-symbol" unoptimized /> : <span className="brand-mark"><Sparkles size={22} /></span>}
    <span className={logoKey ? "brand-wordmark brand-wordmark-custom" : "brand-wordmark"}>{brandName}</span>
  </>;
}
