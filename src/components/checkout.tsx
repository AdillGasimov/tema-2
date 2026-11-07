"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { FreeDeliveryNote } from "./free-delivery-note";
import { money } from "@/lib/money";
import { deliveryCharge, deliveryRegionList } from "@/lib/delivery";
import type { PublicSettings } from "./store-shell";
export function CartView({ deliveryFreeRegions }: { deliveryFreeRegions: string }) {
  const { items, quantity } = useCart(); const [code, setCode] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/referrals").then(r => r.json()).then(d => setCode(d.code ?? "")); }, []);
  async function apply() { const r = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const d = await r.json(); setMessage(r.ok ? `Referal kodu tətbiq edildi: ${d.code}` : d.error); }
  if (!items.length) return <div className="empty-state"><ShoppingBag size={48} strokeWidth={1} /><h2>Səbətiniz hələ boşdur.</h2><p>Avtomobiliniz üçün bir az qayğı seçin.</p><Link className="btn btn-dark" href="/products">Məhsullara bax <ArrowRight size={16} /></Link></div>;
  return <div className="checkout-grid"><div className="cart-items">{items.map(i => <div className="cart-item" key={i.variantId}><Link href={`/products/${i.slug}`} className="cart-item-image">{i.imageKey ? <Image src={`/api/media/${i.imageKey}`} width={96} height={96} alt={i.name} unoptimized /> : <ShoppingBag strokeWidth={1} />}</Link><div className="cart-item-title"><Link href={`/products/${i.slug}`}><h3>{i.name}</h3></Link><span className="muted">{i.variant}</span><strong>{money(i.priceMinor)}</strong></div><div className="quantity-control"><button onClick={() => quantity(i.variantId, i.quantity - 1)} aria-label={`${i.name} azalt`}><Minus size={14} /></button><span>{i.quantity}</span><button disabled={i.quantity >= (i.maxQuantity ?? 100)} onClick={() => quantity(i.variantId, i.quantity + 1)} aria-label={`${i.name} artır`}><Plus size={14} /></button></div><strong>{money(i.priceMinor * i.quantity)}</strong><button className="icon-btn" onClick={() => quantity(i.variantId, 0)} aria-label={`${i.name} sil`}><Trash2 size={18} /></button></div>)}</div><aside className="summary-card"><p className="eyebrow">SİFARİŞİNİZ</p><h2>Səbət cəmi</h2><div className="summary-line"><span>Məhsullar</span><strong>{money(items.reduce((n, i) => n + i.priceMinor * i.quantity, 0))}</strong></div><FreeDeliveryNote regions={deliveryFreeRegions} /><p className="form-hint">Çatdırılma məbləği sifariş mərhələsində göstərilir.</p><label className="field">Referal kodu (istəyə bağlı)<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Məsələn, ALI01" maxLength={24} /></label><button className="text-link" type="button" onClick={apply}>Kodu tətbiq et <ArrowRight size={14} /></button><p role="status" className="form-hint">{message}</p><Link className="btn btn-dark full" href="/checkout">Sifarişi rəsmiləşdir <ArrowRight size={18} /></Link></aside></div>;
}
export function CheckoutForm({ settings: s }: { settings: PublicSettings }) {
  const { items, clear } = useCart(); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [city, setCity] = useState(() => {
    const destinations = deliveryRegionList(s.deliveryRegions);
    return deliveryRegionList(s.deliveryFreeRegions).find(region => destinations.includes(region)) ?? "";
  });
  const [result, setResult] = useState<{ reference: string; totalMinor: number; whatsappUrl: string } | null>(null);
  useEffect(() => { fetch("/api/referrals").then(r => r.json()).then(d => setCode(d.code ?? "")); }, []);
  const subtotal = items.reduce((n, i) => n + i.priceMinor * i.quantity, 0);
  const delivery = deliveryCharge(s, subtotal, city);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    const popup = window.open("about:blank", "_blank"); if (popup) popup.opener = null;
    const f = new FormData(event.currentTarget);
    const data = { name: f.get("name"), phone: f.get("phone"), city: f.get("city"), address: f.get("address"), notes: f.get("notes"), referralCode: code, items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })) };
    const fingerprint = JSON.stringify(data);
    let stored: { fingerprint: string; key: string } | null = null;
    try { stored = JSON.parse(sessionStorage.getItem("checkout-attempt") ?? "null"); } catch { /* regenerate only corrupt local metadata */ }
    const idempotencyKey = stored?.fingerprint === fingerprint ? stored.key : crypto.randomUUID();
    sessionStorage.setItem("checkout-attempt", JSON.stringify({ fingerprint, key: idempotencyKey }));
    try {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, idempotencyKey }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setResult(d); clear(); sessionStorage.removeItem("checkout-attempt");
      if (popup) popup.location.replace(d.whatsappUrl);
    } catch (e) { popup?.close(); setError(e instanceof Error ? e.message : "Sifariş alınmadı. Yenidən cəhd edin."); }
    finally { setBusy(false); }
  }
  if (result) return <div className="success-card"><CheckCircle2 size={48} strokeWidth={1} /><p className="eyebrow">SİFARİŞ SORĞUSU QEYDƏ ALINDI</p><h1>Təşəkkür edirik!</h1><p>Sifariş nömrəniz: <strong data-testid="order-reference">{result.reference}</strong></p><p>Yekun məbləğ: <strong>{money(result.totalMinor)}</strong></p><div className="notice">WhatsApp-da mesajı göndərərək sifarişi təsdiq üçün bizə çatdırın. Sifariş hələ ödənilmiş və ya tamamlanmış sayılmır.</div><a className="btn btn-dark" href={result.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={18} /> WhatsApp-da mesajı göndər</a><Link href="/products" className="text-link">Mağazaya qayıt <ArrowRight size={16} /></Link></div>;
  if (!items.length) return <div className="empty-state"><ShoppingBag size={48} /><h2>Səbətiniz boşdur.</h2><Link className="btn btn-dark" href="/products">Məhsullara bax</Link></div>;
  return <form onSubmit={submit} className="checkout-grid"><div className="checkout-form"><p className="eyebrow">ƏLAQƏ VƏ ÇATDIRILMA</p><h2>Sizi tanıyaq.</h2><div className="form-grid"><label className="field">Ad və soyad<input name="name" autoComplete="name" minLength={2} maxLength={100} required placeholder="Adınız və soyadınız" /></label><label className="field">Telefon nömrəsi<input name="phone" type="tel" autoComplete="tel" required placeholder="+994 50 000 00 00" maxLength={24} /></label><label className="field span-2">Şəhər və ya bölgə<select name="city" aria-label="Şəhər və ya bölgə" value={city} onChange={e => setCity(e.target.value)} required><option value="">Bölgənizi seçin</option>{deliveryRegionList(s.deliveryRegions).map(v => <option key={v}>{v}</option>)}</select></label><label className="field span-2">Çatdırılma ünvanı<textarea name="address" autoComplete="street-address" required minLength={5} maxLength={500} rows={3} placeholder="Küçə, bina, mənzil və digər məlumatlar" /></label><label className="field span-2">Əlavə qeyd (istəyə bağlı)<textarea name="notes" maxLength={1000} rows={2} /></label><label className="field span-2">Referal kodu (istəyə bağlı)<input aria-label="Referal kodu (istəyə bağlı)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={24} placeholder="Tərəfdaşın referal kodu" /><small>Sizi bizə tövsiyə edən şəxsin kodu varsa, daxil edin.</small></label></div><label className="checkbox-line"><input type="checkbox" required /> <span><Link href="/privacy" target="_blank">Məxfilik siyasəti</Link> ilə tanış oldum və sifariş üçün məlumatlarımın emalına razıyam.</span></label></div><aside className="summary-card"><p className="eyebrow">SON BİR BAXIŞ</p><h2>Sifariş xülasəsi</h2><FreeDeliveryNote regions={s.deliveryFreeRegions} />{items.map(i => <div className="summary-line" key={i.variantId}><span>{i.name}<small>{i.variant} · {i.quantity} ədəd</small></span><strong>{money(i.priceMinor * i.quantity)}</strong></div>)}<div className="summary-line"><span>Çatdırılma</span><strong>{money(delivery)}</strong></div><div className="summary-total"><span>Yekun</span><strong>{money(subtotal + delivery)}</strong></div><div className="notice"><MessageCircle size={20} /><span>Onlayn kart ödənişi tələb olunmur. Sifariş və ödəniş WhatsApp ilə ayrıca təsdiqlənir.</span></div>{error && <p role="alert" className="error-message">{error}</p>}{!s.whatsapp && <p className="error-message">Sifariş qəbulu hələ aktiv deyil.</p>}<button className="btn btn-dark full" disabled={busy || !s.whatsapp}>{busy ? "Qeydə alınır…" : "Sifariş ver"}<ArrowUpRightIcon /></button><p className="form-hint">Sifarişdən sonra WhatsApp pəncərəsi açılacaq. Mesajı özünüz göndərməlisiniz.</p></aside></form>;
}
function ArrowUpRightIcon() { return <ArrowRight size={18} />; }
