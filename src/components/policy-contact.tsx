import type { publicSettings } from "@/lib/settings";
export function PolicyContact({ settings: s }: { settings: Awaited<ReturnType<typeof publicSettings>> }) {
  const phone = s.phone || s.whatsapp;
  return <address className="policy-contact"><strong>{s.legalName || s.brandName}</strong>{s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}{phone && <a href={`tel:${phone}`}>{phone}</a>}{s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp ilə əlaqə</a>}{s.businessAddress && <span>{s.businessAddress}</span>}</address>;
}
