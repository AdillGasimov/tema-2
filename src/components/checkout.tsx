"use client";
import { StoreLink as Link } from "./store-link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, MessageCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { FreeDeliveryNote } from "./free-delivery-note";
import { CheckoutContactFields, CheckoutFieldError } from "./checkout-contact-fields";
import { WhatsAppOrderActions } from "./whatsapp-order-actions";
import { whatsappHandoff } from "@/lib/whatsapp-handoff";
import { checkoutContactErrors, checkoutContactMessages, normalizeCheckoutPhone, type CheckoutField, type CheckoutFieldErrors } from "@/lib/checkout-contact";
import { money } from "@/lib/money";
import { deliveryCharge, deliveryRegionList } from "@/lib/delivery";
import type { PublicSettings } from "./store-shell";
function contactFieldName(target: EventTarget) {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target.name : "";
}
export function CartView({ deliveryFreeRegions }: { deliveryFreeRegions: string }) {
  const { items, quantity } = useCart(); const [code, setCode] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/referrals").then(r => r.json()).then(d => setCode(d.code ?? "")); }, []);
  async function apply() { const r = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const d = await r.json(); setMessage(r.ok ? `Referal kodu tətbiq edildi: ${d.code}` : d.error); }
  if (!items.length) return <div className="empty-state"><ShoppingBag size={48} strokeWidth={1} /><h2>Səbətiniz hələ boşdur.</h2><p>Avtomobiliniz üçün bir az qayğı seçin.</p><Link className="btn btn-dark" href="/products">Məhsullara bax <ArrowRight size={16} /></Link></div>;
  return <div className="checkout-grid"><div className="cart-items">{items.map(i => <div className="cart-item" key={i.variantId}><Link href={`/products/${i.slug}`} className="cart-item-image">{i.imageKey ? <Image src={`/api/media/${i.imageKey}`} width={96} height={96} alt={i.name} unoptimized /> : <ShoppingBag strokeWidth={1} />}</Link><div className="cart-item-title"><Link href={`/products/${i.slug}`}><h3>{i.name}</h3></Link><span className="muted">{i.variant}</span><strong>{money(i.priceMinor)}</strong></div><div className="quantity-control"><button onClick={() => quantity(i.variantId, i.quantity - 1)} aria-label={`${i.name} azalt`}><Minus size={14} /></button><span>{i.quantity}</span><button disabled={i.quantity >= (i.maxQuantity ?? 100)} onClick={() => quantity(i.variantId, i.quantity + 1)} aria-label={`${i.name} artır`}><Plus size={14} /></button></div><strong>{money(i.priceMinor * i.quantity)}</strong><button className="icon-btn" onClick={() => quantity(i.variantId, 0)} aria-label={`${i.name} sil`}><Trash2 size={18} /></button></div>)}</div><aside className="summary-card"><p className="eyebrow">SİFARİŞİNİZ</p><h2>Səbət cəmi</h2><div className="summary-line"><span>Məhsullar</span><strong>{money(items.reduce((n, i) => n + i.priceMinor * i.quantity, 0))}</strong></div><FreeDeliveryNote regions={deliveryFreeRegions} /><p className="form-hint">Çatdırılma məbləği sifariş mərhələsində göstərilir.</p><label className="field">Referal kodu (istəyə bağlı)<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Məsələn, ALI01" maxLength={24} /></label><button className="text-link" type="button" onClick={apply}>Kodu tətbiq et <ArrowRight size={14} /></button><p role="status" className="form-hint">{message}</p><Link className="btn btn-dark full" href="/checkout">Sifarişi rəsmiləşdir <ArrowRight size={18} /></Link></aside></div>;
}
export function CheckoutForm({ settings: s }: { settings: PublicSettings }) {
  const { items, clear } = useCart(); const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const checkoutAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [city, setCity] = useState(() => {
    const destinations = deliveryRegionList(s.deliveryRegions);
    return deliveryRegionList(s.deliveryFreeRegions).find(region => destinations.includes(region)) ?? "";
  });
  const [result, setResult] = useState<{ reference: string; totalMinor: number; whatsappUrl: string; whatsappMessage: string } | null>(null);
  useEffect(() => { fetch("/api/referrals").then(r => r.json()).then(d => setCode(d.code ?? "")); }, []);
  const subtotal = items.reduce((n, i) => n + i.priceMinor * i.quantity, 0);
  const delivery = deliveryCharge(s, subtotal, city);
  function contactErrors(form: FormData) {
    const errors = checkoutContactErrors({ name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? ""), city: String(form.get("city") ?? ""), address: String(form.get("address") ?? "") });
    if (!form.has("consent")) errors.consent = checkoutContactMessages.consent;
    return errors;
  }
  function checkField(form: HTMLFormElement, name: string) {
    if (!["name", "phone", "city", "address", "consent"].includes(name)) return;
    const field = name as CheckoutField;
    const errors = contactErrors(new FormData(form));
    setFieldErrors(previous => ({ ...previous, [field]: errors[field] }));
  }
  function focusError(form: HTMLFormElement, errors: CheckoutFieldErrors) {
    const field = form.elements.namedItem(Object.keys(errors)[0]);
    if (field instanceof HTMLElement) field.focus();
  }
  function changePhone(value: string) {
    const normalized = normalizeCheckoutPhone(value);
    if (/^[0-9]{0,9}$/.test(value) || normalized) {
      setPhone(normalized ? normalized.slice(4) : value);
      if (fieldErrors.phone) setFieldErrors(previous => ({ ...previous, phone: normalized ? undefined : checkoutContactMessages.phone }));
    } else setFieldErrors(previous => ({ ...previous, phone: /^[+0-9\s()-]+$/.test(value) ? checkoutContactMessages.phone : checkoutContactMessages.phoneCharacters }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const f = new FormData(form);
    const errors = contactErrors(f);
    setFieldErrors(errors); setError("");
    if (Object.keys(errors).length) { focusError(form, errors); return; }
    setBusy(true);
    let popup: Window | null = null;
    try { popup = window.open("about:blank", "_blank"); if (popup) popup.opener = null; } catch { /* The success screen still offers the WhatsApp link. */ }
    const data = { name: f.get("name"), phone: normalizeCheckoutPhone(String(f.get("phone")))!, city: f.get("city"), address: f.get("address"), notes: f.get("notes"), referralCode: code, items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })) };
    const fingerprint = JSON.stringify(data);
    let stored = checkoutAttempt.current;
    if (!stored) { try { stored = JSON.parse(sessionStorage.getItem("checkout-attempt") ?? "null"); } catch { /* Use the in-memory attempt if storage is blocked. */ } }
    const idempotencyKey = stored?.fingerprint === fingerprint ? stored.key : crypto.randomUUID();
    checkoutAttempt.current = { fingerprint, key: idempotencyKey };
    try { sessionStorage.setItem("checkout-attempt", JSON.stringify(checkoutAttempt.current)); } catch { /* Keep the same key in memory for safe retries. */ }
    let requestError = "Sifariş alınmadı. Yenidən cəhd edin.";
    try {
      const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, idempotencyKey }) });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        const errors: CheckoutFieldErrors = {};
        for (const field of ["name", "phone", "city", "address"] as const) {
          const messages = d?.fields?.fieldErrors?.[field];
          if (Array.isArray(messages) && typeof messages[0] === "string") errors[field] = messages[0];
        }
        if (Object.keys(errors).length) { setFieldErrors(errors); focusError(form, errors); }
        if (typeof d?.error === "string") requestError = d.error;
        throw new Error(requestError);
      }
      if (!d || typeof d.reference !== "string" || typeof d.totalMinor !== "number" || typeof d.whatsappUrl !== "string") throw new Error(requestError);
      const handoff = whatsappHandoff(d.whatsappUrl, navigator, typeof d.whatsappMessage === "string" ? d.whatsappMessage : undefined);
      setResult({ ...d, whatsappUrl: handoff.url, whatsappMessage: handoff.message }); clear(); checkoutAttempt.current = null;
      try { sessionStorage.removeItem("checkout-attempt"); } catch { /* Storage cleanup must not hide a successful order. */ }
      if (popup) popup.location.replace(handoff.url);
    } catch { popup?.close(); setError(requestError); }
    finally { setBusy(false); }
  }
  if (result) return <div className="success-card"><CheckCircle2 size={48} strokeWidth={1} /><p className="eyebrow">SİFARİŞ SORĞUSU QEYDƏ ALINDI</p><h1>Təşəkkür edirik!</h1><p>Sifariş nömrəniz: <strong data-testid="order-reference">{result.reference}</strong></p><p>Yekun məbləğ: <strong>{money(result.totalMinor)}</strong></p><div className="notice">WhatsApp-da mesajı göndərərək sifarişi təsdiq üçün bizə çatdırın. Sifariş hələ ödənilmiş və ya tamamlanmış sayılmır.</div><WhatsAppOrderActions url={result.whatsappUrl} message={result.whatsappMessage} /><Link href="/products" className="text-link">Mağazaya qayıt <ArrowRight size={16} /></Link></div>;
  if (!items.length) return <div className="empty-state"><ShoppingBag size={48} /><h2>Səbətiniz boşdur.</h2><Link className="btn btn-dark" href="/products">Məhsullara bax</Link></div>;
  return <form onSubmit={submit} noValidate className="checkout-grid" onBlur={event => checkField(event.currentTarget, contactFieldName(event.target))} onChange={event => { const name = contactFieldName(event.target); if (fieldErrors[name as CheckoutField]) checkField(event.currentTarget, name); }}><div className="checkout-form"><p className="eyebrow">ƏLAQƏ VƏ ÇATDIRILMA</p><h2>Sizi tanıyaq.</h2><div className="form-grid"><CheckoutContactFields phone={phone} city={city} regions={deliveryRegionList(s.deliveryRegions)} errors={fieldErrors} onPhoneChange={changePhone} onCityChange={setCity} /><label className="field span-2">Əlavə qeyd (istəyə bağlı)<textarea name="notes" maxLength={1000} rows={2} /></label><label className="field span-2">Referal kodu (istəyə bağlı)<input aria-label="Referal kodu (istəyə bağlı)" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={24} placeholder="Tərəfdaşın referal kodu" /><small>Sizi bizə tövsiyə edən şəxsin kodu varsa, daxil edin.</small></label></div><label className="checkbox-line"><input name="consent" type="checkbox" required aria-invalid={!!fieldErrors.consent} aria-describedby={fieldErrors.consent ? "checkout-consent-error" : undefined} /> <span><Link href="/privacy" target="_blank">Məxfilik siyasəti</Link> ilə tanış oldum və sifariş üçün məlumatlarımın emalına razıyam.</span></label><CheckoutFieldError name="consent" message={fieldErrors.consent} /></div><aside className="summary-card"><p className="eyebrow">SON BİR BAXIŞ</p><h2>Sifariş xülasəsi</h2><FreeDeliveryNote regions={s.deliveryFreeRegions} />{items.map(i => <div className="summary-line" key={i.variantId}><span>{i.name}<small>{i.variant} · {i.quantity} ədəd</small></span><strong>{money(i.priceMinor * i.quantity)}</strong></div>)}<div className="summary-line"><span>Çatdırılma</span><strong>{money(delivery)}</strong></div><div className="summary-total"><span>Yekun</span><strong>{money(subtotal + delivery)}</strong></div><div className="notice"><MessageCircle size={20} /><span>Onlayn kart ödənişi tələb olunmur. Sifariş və ödəniş WhatsApp ilə ayrıca təsdiqlənir.</span></div>{error && <p role="alert" className="error-message">{error}</p>}{!s.whatsapp && <p className="error-message">Sifariş qəbulu hələ aktiv deyil.</p>}<button className="btn btn-dark full" disabled={busy || !s.whatsapp}>{busy ? "Qeydə alınır…" : "Sifariş ver"}<ArrowUpRightIcon /></button><p className="form-hint">Sifarişdən sonra WhatsApp pəncərəsi açılacaq. Mesajı özünüz göndərməlisiniz.</p></aside></form>;
}
function ArrowUpRightIcon() { return <ArrowRight size={18} />; }
