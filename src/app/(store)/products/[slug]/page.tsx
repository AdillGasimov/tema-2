import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicProductSelect } from "@/lib/catalog";
import { publicSettings } from "@/lib/settings";
import { conciseDescription, pageMetadata } from "@/lib/seo";
import { Gallery, Purchase } from "@/components/purchase";
import { ProductCard } from "@/components/product-card";
const product = cache((slug: string) => db.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: publicProductSelect }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = await product((await params).slug);
  if (!p) return { title: "Məhsul tapılmadı", robots: { index: false } };
  const description = p.seoDescription || conciseDescription(p.shortDescription || p.description || `${p.name}. ${p.category.name} kateqoriyasında məhsul. Qiymət və stok məlumatlarını yoxlayın, sifarişi WhatsApp vasitəsilə təsdiqləyin.`);
  const metadata = await pageMetadata(p.seoTitle || p.name, description, `/products/${p.slug}`);
  return { ...metadata, openGraph: { ...metadata.openGraph, ...(p.images[0] ? { images: [{ url: `/api/media/${p.images[0].key}`, alt: p.name }] } : {}) } };
}
export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const p = await product((await params).slug); if (!p) notFound(); const s = await publicSettings();
  const related = await db.product.findMany({ where: { status: "PUBLISHED", categoryId: p.category.id, id: { not: p.id } }, select: publicProductSelect, take: 4 });
  const structured = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.shortDescription || p.description, image: p.images.map(i => new URL(`/api/media/${i.key}`, s.domain).toString()), offers: p.variants.map(v => ({ "@type": "Offer", priceCurrency: "AZN", price: ((v.discountMinor ?? v.priceMinor) / 100).toFixed(2), availability: `https://schema.org/${v.stock > v.reserved ? "InStock" : "OutOfStock"}`, url: new URL(`/products/${p.slug}`, s.domain).toString(), sku: v.sku })) };
  return <div className="container"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><div className="breadcrumb"><Link href="/">Ana səhifə</Link><span>/</span><Link href={`/products?category=${p.category.slug}`}>{p.category.name}</Link><span>/</span>{p.name}</div>
    <div className="product-detail"><Gallery images={p.images} name={p.name} /><div className="product-detail-info"><p className="eyebrow">{p.category.name}</p><h1>{p.name}</h1><p className="detail-short-description">{p.shortDescription || conciseDescription(p.description, 240)}</p><Purchase key={p.id} product={p} /></div></div>
    {p.description && <section className="product-full-description" aria-labelledby="description-title"><h2 id="description-title">Məhsul haqqında</h2><p className="detail-description">{p.description}</p></section>}
    {related.length > 0 && <section className="section"><div className="section-heading"><h2>Bunları da kəşf edin.</h2></div><div className="product-grid">{related.map(p => <ProductCard key={p.id} product={p} />)}</div></section>}
  </div>;
}
