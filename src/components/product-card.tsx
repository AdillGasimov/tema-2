import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Package } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
export function ProductCard({ product: p }: { product: PublicProduct }) {
  const v = [...p.variants].sort((a, b) => (a.discountMinor ?? a.priceMinor) - (b.discountMinor ?? b.priceMinor))[0];
  if (!v) return null;
  const available = p.variants.some(v => v.stock > v.reserved);
  return <article className="product-card"><Link href={`/products/${p.slug}`} className="product-visual" aria-label={p.name}>{p.images[0] ? <Image src={`/api/media/${p.images[0].key}`} alt={p.images[0].alt} fill sizes="(max-width: 600px) 50vw, 25vw" unoptimized /> : <div className="product-placeholder"><Package size={56} strokeWidth={1} /><span>Şəkil əlavə ediləcək</span></div>}{v.discountMinor !== null && <span className="product-tag">Endirim</span>}<span className="product-arrow"><ArrowUpRight size={20} /></span></Link><div className="product-card-info"><span className="eyebrow">{p.category.name}</span><Link href={`/products/${p.slug}`}><h3>{p.name}</h3></Link><div className="product-price"><strong>{money(v.discountMinor ?? v.priceMinor)}</strong>{v.discountMinor !== null && <del>{money(v.priceMinor)}</del>}<span className={available ? "in-stock" : "out-stock"}><i />{available ? "Stokda" : "Bitib"}</span></div></div></article>;
}
