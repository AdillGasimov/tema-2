"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
import { availability } from "@/lib/availability";
import { useCart } from "./cart-provider";
export function Gallery({ images, name }: { images: PublicProduct["images"]; name: string }) {
  const [index, setIndex] = useState(0);
  return <div><div className="detail-image">{images[index] ? <Image src={`/api/media/${images[index].key}`} alt={images[index].alt} fill sizes="(max-width: 768px) 100vw, 50vw" unoptimized priority /> : <span>Şəkil əlavə ediləcək</span>}</div><div className="thumbnails">{images.map((i, n) => <button key={i.id} className={n === index ? "selected" : ""} aria-label={`${name} şəkil ${n + 1}`} onClick={() => setIndex(n)}><Image src={`/api/media/${i.key}`} width={72} height={72} alt={i.alt} unoptimized /></button>)}</div></div>;
}
export function Purchase({ product: p }: { product: PublicProduct }) {
  const [variantId, setVariantId] = useState(p.variants.find(v => v.stock > v.reserved)?.id ?? p.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, items } = useCart(); const router = useRouter();
  const v = p.variants.find(v => v.id === variantId);
  if (!v) return <p>Bu məhsul hazırda satışda deyil.</p>;
  const stock = Math.max(0, v.stock - v.reserved);
  const stockState = availability([v]);
  const inCart = items.find(item => item.variantId === v.id)?.quantity ?? 0;
  function addItem(buy = false) {
    if (!v || stock < quantity || quantity < 1) return;
    if (buy && inCart >= quantity) { router.push("/checkout"); return; }
    add({ variantId: v.id, name: p.name, variant: v.name, priceMinor: v.discountMinor ?? v.priceMinor, quantity: buy ? quantity - inCart : quantity, imageKey: p.images[0]?.key, slug: p.slug }, stock);
    setAdded(true); if (buy) router.push("/checkout");
  }
  return <div className="purchase"><div className="detail-price">{money(v.discountMinor ?? v.priceMinor)}{v.discountMinor !== null && <del>{money(v.priceMinor)}</del>}</div><p className={stockState.className}>{stockState.label}{v.storeSku && <> · SKU: {v.storeSku}</>}</p>{p.variants.length > 1 && <label className="field">Variant<select aria-label="Variant" value={variantId} onChange={e => { setVariantId(e.target.value); setQuantity(1); setAdded(false); }}>{p.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}<div className="purchase-actions"><div className="quantity-control"><button type="button" aria-label="Azalt" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><span>{quantity}</span><button type="button" aria-label="Artır" disabled={stock <= quantity || quantity >= 100} onClick={() => setQuantity(Math.max(1, Math.min(stock, quantity + 1, 100)))}><Plus size={16} /></button></div><button className="btn btn-dark" disabled={stock <= 0 || stock < quantity || inCart >= stock} onClick={() => addItem()}>{added ? <Check size={18} /> : <ShoppingBag size={18} />}{added ? "Səbətə əlavə edildi" : "Səbətə əlavə et"}</button></div><button className="btn btn-outline full" disabled={stock <= 0 || stock < quantity} onClick={() => addItem(true)}>İndi sifariş et</button><p className="form-hint">Ödəniş və çatdırılma sifarişdən sonra WhatsApp ilə təsdiqlənir.</p><div aria-live="polite" className="sr-only">{added ? "Məhsul səbətə əlavə edildi" : ""}</div></div>;
}
