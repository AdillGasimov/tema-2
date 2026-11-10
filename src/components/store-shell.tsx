"use client";
import { StoreLink as Link } from "./store-link";
import { BrandLogo } from "./brand-logo";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, Search, ShoppingBag, X, ArrowRight, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { useCart } from "./cart-provider";
import { freeDeliveryMessage } from "@/lib/delivery";
import { money } from "@/lib/money";
import type { publicSettings } from "@/lib/settings";
export type PublicSettings = Awaited<ReturnType<typeof publicSettings>>;
export function StoreHeader({ settings: s, categories }: { settings: PublicSettings; categories: { name: string; slug: string }[] }) {
  const { items } = useCart();
  const [open, setOpen] = useState(false); const [referralError, setReferralError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then(async r => { if (!r.ok) setReferralError((await r.json()).error); }).catch(() => setReferralError("Referal kodunu yoxlamaq alınmadı. Kodu sifariş zamanı daxil edə bilərsiniz."));
  }, []);
  return <>
    <div className="announcement"><span>{s.announcement || "Avtomobilinizə qayğı, hər detalda."}</span><span className="announcement-right">Azərbaycan · AZN <ArrowUpRight size={12} /></span></div>{referralError && <div className="container error-message" role="alert">{referralError}</div>}
    <header className="store-header"><div className="container header-main">
      <Link href="/" className="brand" aria-label={s.brandName}><BrandLogo brandName={s.brandName} logoKey={s.logoKey} faviconKey={s.faviconKey} /></Link>
      <form className="header-search" action="/products"><Search size={19} /><input name="q" placeholder="Avtomobiliniz üçün nə axtarırsınız?" aria-label="Məhsul axtar" /><kbd>↵</kbd></form>
      <div className="header-actions"><Link href="/partner" className="partner-link">Tərəfdaş girişi <ArrowUpRight size={14} /></Link><Link href="/cart" className="cart-link" aria-label="Səbət"><ShoppingBag size={21} /><span className="cart-count">{items.reduce((n, i) => n + i.quantity, 0)}</span></Link><button className="icon-btn mobile-menu" aria-label="Menyunu aç" aria-expanded={open} aria-controls="store-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
    </div><nav id="store-navigation" className={`container store-nav ${open ? "is-open" : ""}`} aria-label="Əsas menyu"><Link href="/products" className="all-products" onClick={() => setOpen(false)}><Menu size={16} /> Bütün məhsullar</Link>{categories.map(c => <Link key={c.slug} href={`/products?category=${encodeURIComponent(c.slug)}`} onClick={() => setOpen(false)}>{c.name}</Link>)}<Link href="/#how-it-works" onClick={() => setOpen(false)}>Necə sifariş etməli?</Link></nav></header>
  </>;
}
export function StoreFooter({ settings: s }: { settings: PublicSettings }) {
  return <><section className="contact-strip container"><div><p className="eyebrow">BİRLİKDƏ DAHA YAXŞI</p><h2>Avtomobiliniz üçün doğru seçim.</h2><p>Məhsul və sifarişlə bağlı suallarınızı bizə yazın.</p></div>{s.whatsapp && <a className="btn btn-dark" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp ilə əlaqə <ArrowUpRight size={18} /></a>}</section>
  <footer className="store-footer"><div className="container footer-grid"><div><Link className="brand" href="/"><BrandLogo brandName={s.brandName} logoKey={s.logoKey} faviconKey={s.faviconKey} dark /></Link><p>{s.description}</p><span className="footer-tag">{freeDeliveryMessage(s.deliveryFreeRegions) || "Avtomobilinizə qayğı ilə."}</span></div><div><h3>Mağaza</h3><Link href="/products">Məhsullar</Link><Link href="/cart">Səbət</Link><Link href="/#delivery">Çatdırılma</Link><Link href="/terms">İstifadə və satış şərtləri</Link><Link href="/returns">Qaytarılma və dəyişdirmə</Link></div><div><h3>Tərəfdaşlıq</h3><Link href="/partner">Tərəfdaş kabineti</Link><Link href="/partnership">Tərəfdaşlıq haqqında</Link><Link href="/privacy">Məxfilik siyasəti</Link></div><div><h3>Əlaqə</h3>{s.phone && <a href={`tel:${s.phone}`}>{s.phone}</a>}{s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}{s.instagram && <a href={s.instagram} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={13} /></a>}{s.tiktok && <a href={s.tiktok} target="_blank" rel="noreferrer">TikTok <ArrowUpRight size={13} /></a>}{s.socialLinks && <p>{s.socialLinks}</p>}</div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} {s.brandName}</span><span>Azərbaycan üçün hazırlanıb. <span className="tiny-dot" /> AZN</span></div></footer></>;
}
export function TrustRow({ settings: s }: { settings: Pick<PublicSettings, "deliveryFreeRegions" | "deliveryFeeMinor"> }) { const free = freeDeliveryMessage(s.deliveryFreeRegions); return <div className="trust-row container"><div><Truck /><span><strong>Ünvana çatdırılma</strong><small>{free || `Çatdırılma haqqı: ${money(s.deliveryFeeMinor)}`}</small></span></div><div><MessageCircle /><span><strong>Birbaşa əlaqə</strong><small>WhatsApp ilə rahat sifariş</small></span></div><div><ShieldCheck /><span><strong>Şəffaf sifariş prosesi</strong><small>Hər sifarişə fərdi təsdiq</small></span></div><Link href="/products">Kolleksiyaya bax <ArrowRight size={18} /></Link></div>; }
