import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { publicProductSelect } from "@/lib/catalog";
import { publicSettings } from "@/lib/settings";
import { Gallery, Purchase } from "@/components/purchase";
import { ProductCard } from "@/components/product-card";
async function product(slug: string) { return db.product.findFirst({ where: { slug, status: "PUBLISHED" }, select: publicProductSelect }); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const p = await product((await params).slug); return { title: p?.seoTitle || p?.name || "Məhsul", description: p?.seoDescription || p?.description.slice(0, 160), ...(p?.images[0] ? { openGraph: { images: [`/api/media/${p.images[0].key}`] } } : {}) }; }
export default async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const p = await product((await params).slug); if (!p) notFound(); const s = await publicSettings();
  const related = await db.product.findMany({ where: { status: "PUBLISHED", categoryId: p.category.id, id: { not: p.id } }, select: publicProductSelect, take: 4 });
  const structured = { "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, image: p.images.map(i => `${s.domain}/api/media/${i.key}`), offers: p.variants.map(v => ({ "@type": "Offer", priceCurrency: "AZN", price: ((v.discountMinor ?? v.priceMinor) / 100).toFixed(2), availability: `https://schema.org/${v.stock > v.reserved ? "InStock" : "OutOfStock"}`, url: `${s.domain}/products/${p.slug}`, sku: v.sku })) };
  return <div className="container"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }} /><div className="breadcrumb"><Link href="/">Ana səhifə</Link><span>/</span><Link href="/products">Məhsullar</Link><span>/</span>{p.name}</div><div className="product-detail"><Gallery images={p.images} name={p.name} /><div className="product-detail-info"><p className="eyebrow">{p.category.name}</p><h1>{p.name}</h1><p className="detail-description">{p.description}</p><Purchase product={p} /></div></div>{related.length > 0 && <section className="section"><div className="section-heading"><h2>Bunları da kəşf edin.</h2></div><div className="product-grid">{related.map(p => <ProductCard key={p.id} product={p} />)}</div></section>}</div>;
}
