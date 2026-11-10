import { publicImageSrc } from "@/lib/public-image";
import { StoreLink as Link } from "./store-link";
import Image from "next/image";
import { ArrowUpRight, Package } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { money } from "@/lib/money";
import { availability } from "@/lib/availability";
import { ProductPhotos } from "./product-photos";
export function ProductCard({ product: p }: { product: PublicProduct }) {
  const v = [...p.variants].sort((a, b) => (a.discountMinor ?? a.priceMinor) - (b.discountMinor ?? b.priceMinor))[0];
  if (!v) return null;
  const stock = availability(p.variants);
  return <article className="product-card">
    {p.images.length > 1 ? <ProductPhotos images={p.images} name={p.name} href={`/products/${p.slug}`} mode="card" discounted={v.discountMinor !== null} /> : <Link href={`/products/${p.slug}`} className="product-visual" aria-label={p.name}>
      {p.images[0] ? <span className="product-image-frame"><Image src={publicImageSrc(p.images[0].key)} alt={p.images[0].alt || p.name} fill sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 24vw" /></span> : <div className="product-placeholder"><Package size={56} strokeWidth={1} /><span>Şəkil əlavə ediləcək</span></div>}
      {v.discountMinor !== null && <span className="product-tag">Endirim</span>}
      <span className="product-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </Link>}
    <div className="product-card-info">
      <span className="eyebrow">{p.category.name}</span>
      <Link href={`/products/${p.slug}`} className="product-title-link" title={p.name}><h3>{p.name}</h3></Link>
      <div className="product-price"><span className="product-price-amounts"><strong>{money(v.discountMinor ?? v.priceMinor)}</strong>{v.discountMinor !== null && <del>{money(v.priceMinor)}</del>}</span><span className={stock.className}><i />{stock.label}</span></div>
    </div>
  </article>;
}
