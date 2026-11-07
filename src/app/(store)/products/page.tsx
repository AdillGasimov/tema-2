import Link from "next/link";
import { cache } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { catalog } from "@/lib/catalog";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { conciseDescription, pageMetadata } from "@/lib/seo";
import { ProductCard } from "@/components/product-card";
type Params = Record<string, string | string[] | undefined>;
const categoriesForPage = cache(() => db.productCategory.findMany({ orderBy: { name: "asc" } }));
const loadCatalog = cache(async (query: string) => {
  try { return { data: await catalog(new URLSearchParams(query)), error: "" }; }
  catch (error) {
    if (!(error instanceof AppError) || error.status !== 400) throw error;
    return { data: { products: [], total: 0, page: 1 }, error: error.message };
  }
});
function queryFor(params: Params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  query.sort(); return query;
}
export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }) {
  const query = queryFor(await searchParams);
  const [categories, { data, error }] = await Promise.all([categoriesForPage(), loadCatalog(query.toString())]);
  const category = categories.find(c => c.slug === query.get("category"));
  const search = (query.get("q") || "").slice(0, 100);
  const title = search ? `${search} üzrə axtarış` : category?.name || "Bütün məhsullar";
  const suffix = data.page > 1 ? ` — ${data.page}-ci səhifə` : "";
  const canonical = new URLSearchParams(); if (category) canonical.set("category", category.slug); if (data.page > 1) canonical.set("page", String(data.page));
  const description = conciseDescription(`${title}. Avtomobiliniz üçün uyğun məhsulları qiymətə və kateqoriyaya görə seçin. Sifariş və çatdırılma WhatsApp vasitəsilə təsdiqlənir.${suffix}`);
  const filtered = Boolean(search || error || query.has("min") || query.has("max") || (query.get("sort") && query.get("sort") !== "newest") || (query.has("category") && !category));
  return pageMetadata(title + suffix, description, `/products${canonical.size ? `?${canonical}` : ""}`, filtered);
}
export default async function Products({ searchParams }: { searchParams: Promise<Params> }) {
  const query = queryFor(await searchParams);
  const [{ data, error }, categories] = await Promise.all([loadCatalog(query.toString()), categoriesForPage()]);
  const category = categories.find(c => c.slug === query.get("category"));
  const pageLink = (n: number) => { const q = new URLSearchParams(query); q.set("page", String(n)); return `/products?${q}`; };
  return <div className="container catalog-page">
    <div className="breadcrumb"><Link href="/">Ana səhifə</Link><span>/</span><Link href="/products">Məhsullar</Link>{category && <><span>/</span>{category.name}</>}</div>
    <p className="eyebrow">AVTOMOBİLİNİZƏ UYĞUN SEÇİM</p><div className="page-title-row"><h1>{category?.name || "Məhsullar"}</h1><span className="muted">{data.total} məhsul</span></div>
    <form className="catalog-filters" action="/products"><div className="filter-search"><Search size={18} /><input name="q" defaultValue={query.get("q") ?? ""} aria-label="Axtarış" placeholder="Məhsul axtarın…" /></div>
      <select name="category" aria-label="Kateqoriya" defaultValue={query.get("category") ?? ""}><option value="">Bütün kateqoriyalar</option>{categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
      <input name="min" type="number" min="0" step="0.01" aria-label="Minimum qiymət AZN" placeholder="Min. AZN" defaultValue={query.get("min") ?? ""} />
      <input name="max" type="number" min="0" step="0.01" aria-label="Maksimum qiymət AZN" placeholder="Maks. AZN" defaultValue={query.get("max") ?? ""} />
      <select name="sort" aria-label="Sıralama" defaultValue={query.get("sort") ?? "newest"}><option value="newest">Əvvəlcə yenilər</option><option value="price-asc">Qiymət: aşağıdan yuxarı</option><option value="price-desc">Qiymət: yuxarıdan aşağı</option><option value="name">Ada görə</option></select>
      <button className="btn btn-dark"><SlidersHorizontal size={16} /> Tətbiq et</button>
    </form>
    {error ? <div className="filter-error"><p className="error-message" role="alert">{error}</p><Link className="btn btn-outline" href="/products">Filtrləri təmizlə</Link></div> : data.products.length ? <div className="product-grid">{data.products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="empty-state"><Search size={42} strokeWidth={1} /><h2>Məhsul tapılmadı.</h2><p>Axtarışı dəyişin və ya yeni kolleksiyamız üçün yenidən baş çəkin.</p><Link className="btn btn-outline" href="/products">Filtrləri təmizlə</Link></div>}
    <div className="pagination">{data.page > 1 && <Link className="btn btn-outline" href={pageLink(data.page - 1)}>Əvvəlki</Link>}{data.total > 12 && <span>{data.page} / {Math.ceil(data.total / 12)}</span>}{data.page * 12 < data.total && <Link className="btn btn-outline" href={pageLink(data.page + 1)}>Növbəti</Link>}</div>
  </div>;
}
