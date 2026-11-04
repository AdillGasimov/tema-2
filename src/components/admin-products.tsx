"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Prisma, ProductCategory } from "@prisma/client";
import { Copy, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { money } from "@/lib/money";
import { ProductCsvImport } from "./product-csv-import";
import { imageFileError, IMAGE_SIZE_MESSAGE } from "@/lib/image-policy";
import { Badge, Empty, Field, MoneyField, MutationFeedback, PageHeading, readMoney, optionalMoney, SaveButton, Table, useMutation, api } from "./dashboard-ui";
type Product = Prisma.ProductGetPayload<{ include: { category: true; variants: true; images: true } }>;
export type ProductsData = { products: Product[]; categories: ProductCategory[]; deletedView: boolean; deletedCount: number };
export async function upload(file: File): Promise<string> {
  const invalid = imageFileError(file); if (invalid) throw new Error(invalid);
  const data = new FormData(); data.set("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: data });
  if (r.status === 413) throw new Error(IMAGE_SIZE_MESSAGE);
  let d;
  try { d = await r.json(); } catch { throw new Error("Şəkil yüklənmədi. Bir az sonra yenidən cəhd edin."); }
  if (!r.ok) throw new Error(typeof d?.error === "string" ? d.error : "Şəkil yüklənmədi.");
  if (typeof d?.key !== "string") throw new Error("Şəkil yüklənmədi. Yenidən cəhd edin.");
  return d.key;
}
export function ProductsPanel({ data }: { data: ProductsData }) {
  const [checked, setChecked] = useState<string[]>([]), [bulkStatus, setBulkStatus] = useState("DRAFT"), [selected, setSelected] = useState<string | null | undefined>();
  const [query, setQuery] = useState(""), [copy, setCopy] = useState<Product | undefined>(), [importOpen, setImportOpen] = useState(false), [trashMessage, setTrashMessage] = useState("");
  const bulk = useMutation("product-bulk"), trash = useMutation("product-trash");
  const busy = bulk.busy || trash.busy, deletedView = data.deletedView;
  const product = selected ? data.products.find(p => p.id === selected) : undefined;
  const checkedIds = checked.filter(id => data.products.some(p => p.id === id));
  const visible = data.products.filter(p => `${p.name} ${p.variants.map(v => v.sku).join(" ")}`.toLocaleLowerCase("az").includes(query.toLocaleLowerCase("az")));
  async function moveProducts(action: "delete" | "restore", ids: string[]) {
    if (!ids.length) return;
    if (action === "delete") {
      const name = ids.length === 1 ? `“${data.products.find(p => p.id === ids[0])?.name}” məhsulu` : `Seçilmiş ${ids.length} məhsul`;
      if (!window.confirm(`${name} silinsin?\n\nMəhsullar kataloqdan və saytdan çıxarılacaq. Sifariş və stok tarixçəsi saxlanılacaq. Silinmişlər bölməsindən bərpa edə bilərsiniz.`)) return;
    }
    setTrashMessage("");
    await trash.run({ action, ids }, result => {
      const count = (result as { count: number }).count;
      setTrashMessage(action === "delete" ? `${count} məhsul silindi. Silinmişlər bölməsindən bərpa edə bilərsiniz.` : `${count} məhsul qaralama kimi bərpa edildi. Yoxladıqdan sonra yayımlaya bilərsiniz.`);
      setChecked(current => current.filter(id => !ids.includes(id)));
      if (selected && ids.includes(selected)) setSelected(undefined);
    });
  }
  function switchView() { setChecked([]); setSelected(undefined); setCopy(undefined); setQuery(""); setImportOpen(false); setTrashMessage(""); }
  return <>
    <PageHeading title="Məhsullar" subtitle="Məhsullar, qiymətlər, maya dəyəri və sayt görünürlüğünü idarə edin." action={<div className="catalog-actions">
      <Link className="btn btn-outline" href={deletedView ? "/admin/products" : "/admin/products?view=deleted"} onClick={switchView}>{deletedView ? "Kataloqa qayıt" : `Silinmişlər (${data.deletedCount})`}</Link>
      {!deletedView && <><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setImportOpen(true)}><Upload size={17} /> CSV idxalı</button><button className="btn btn-dark" disabled={busy} onClick={() => { setCopy(undefined); setSelected(null); }}><Plus size={17} /> Yeni məhsul</button></>}
    </div>} />
    {!deletedView && importOpen && <ProductCsvImport categories={data.categories} onClose={() => setImportOpen(false)} />}
    <MutationFeedback {...bulk} />
    <p className="error-message" role={trash.error ? "alert" : undefined}>{trash.error}</p>
    {trashMessage && <p className="success-message" role="status">{trashMessage}</p>}
    <div className="panel">
      <div className="panel-heading"><h2>{deletedView ? "Silinmiş məhsullar" : "Kataloq"} <span className="count-tag">{data.products.length}</span></h2><div className="inline-search"><Search size={16} /><input aria-label="Məhsullarda axtar" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ad və ya SKU ilə axtar" /></div></div>
      {deletedView && <p className="product-trash-hint">Bərpa edilən məhsullar qaralama kimi saxlanılır. SKU və URL adları tarixçəni qorumaq üçün saxlanılıb.</p>}
      {checkedIds.length > 0 && <div className="panel-heading product-bulk-actions"><span>{checkedIds.length} məhsul seçilib</span>{deletedView ? <button type="button" className="btn btn-small btn-outline" disabled={busy} onClick={() => moveProducts("restore", checkedIds)}><RotateCcw size={15} /> Seçilənləri bərpa et</button> : <>
        <select aria-label="Toplu status" value={bulkStatus} disabled={busy} onChange={e => setBulkStatus(e.target.value)}><option value="DRAFT">Qaralama</option><option value="PUBLISHED">Yayımla</option><option value="ARCHIVED">Arxivlə</option></select>
        <button className="btn btn-small btn-outline" disabled={busy} onClick={() => bulk.run({ ids: checkedIds, status: bulkStatus }, () => setChecked([]))}>Seçilənlərə tətbiq et</button>
        <button type="button" className="btn btn-small btn-outline product-delete-button" disabled={busy} onClick={() => moveProducts("delete", checkedIds)}><Trash2 size={15} /> Seçilənləri sil</button>
      </>}</div>}
      {visible.length ? <Table headers={["Seç", "Məhsul", "Kateqoriya", "Qiymət", "Maya dəyəri", "Mənfəət / vahid", "Stok", "Status", "Əməliyyat"]}>{visible.map(p => <tr key={p.id}>
        <td><input type="checkbox" aria-label={`${p.name} seç`} checked={checkedIds.includes(p.id)} disabled={busy || (!checkedIds.includes(p.id) && checkedIds.length >= 100)} onChange={e => setChecked(e.target.checked ? [...checked, p.id] : checked.filter(id => id !== p.id))} /></td>
        <td><strong>{p.name}</strong><small>{p.slug}</small></td><td>{p.category.name}</td><td>{p.variants[0] ? money(p.variants[0].discountMinor ?? p.variants[0].priceMinor) : "—"}</td><td>{p.variants[0] ? money(p.variants[0].costMinor) : "—"}</td>
        <td>{p.variants[0] ? <>{money((p.variants[0].discountMinor ?? p.variants[0].priceMinor) - p.variants[0].costMinor)}<small>{Math.floor(((p.variants[0].discountMinor ?? p.variants[0].priceMinor) - p.variants[0].costMinor) * 10000 / Math.max(1, p.variants[0].discountMinor ?? p.variants[0].priceMinor)) / 100}% marja</small></> : "—"}</td>
        <td>{p.variants.reduce((n, v) => n + v.stock - v.reserved, 0)}</td><td><Badge value={p.status} /></td>
        <td><div className="table-actions">{deletedView ? <button type="button" className="btn btn-small btn-outline" aria-label={`${p.name} bərpa et`} disabled={busy} onClick={() => moveProducts("restore", [p.id])}><RotateCcw size={15} /> Bərpa et</button> : <>
          <button className="icon-btn" aria-label={`${p.name} redaktə et`} disabled={busy} onClick={() => { setCopy(undefined); setSelected(p.id); }}><Pencil size={16} /></button>
          <button className="icon-btn" aria-label={`${p.name} surətini yarat`} disabled={busy} onClick={() => { setCopy(p); setSelected(null); }}><Copy size={16} /></button>
          <button type="button" className="btn btn-small btn-outline product-delete-button" aria-label={`${p.name} sil`} disabled={busy} onClick={() => moveProducts("delete", [p.id])}><Trash2 size={15} /> Sil</button>
        </>}</div></td>
      </tr>)}</Table> : <Empty text={query ? "Axtarışa uyğun məhsul tapılmadı." : deletedView ? "Silinmiş məhsul yoxdur." : "İlk məhsulunuzu əlavə edin. Yayımlanan məhsullar mağazada görünəcək."} />}
    </div>
    {!deletedView && selected !== undefined && (selected === null || product) && <ProductEditor key={selected ?? `new-${copy?.id ?? ""}`} product={product} duplicate={copy} categories={data.categories} onClose={() => setSelected(undefined)} onSaved={id => { setCopy(undefined); setSelected(id); }} />}
  </>;
}

function ProductEditor({ product, duplicate, categories, onSaved, onClose }: { product?: Product; duplicate?: Product; categories: ProductCategory[]; onSaved: (id: string) => void; onClose: () => void }) {
  const source = product ?? duplicate;
  type Variant = Partial<Product["variants"][number]>;
  const [variants, setVariants] = useState<Variant[]>(source?.variants.map(v => duplicate ? { ...v, id: undefined, sku: `${v.sku}-COPY`, stock: 0 } : v) ?? [{ name: "Standart", costMinor: 0, priceMinor: 0, stock: 0, lowStock: 5, active: true }]);
  const router = useRouter(); const m = useMutation("products"); const images = useMutation("images"); const [uploading, setUploading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      await m.run({ ...(product ? { id: product.id } : {}), name: f.get("name"), slug: f.get("slug"), description: f.get("description"), categoryId: f.get("categoryId"), status: f.get("status"), featured: f.has("featured"), seoTitle: f.get("seoTitle"), seoDescription: f.get("seoDescription"),
        variants: variants.map((v, n) => ({ ...(v.id ? { id: v.id } : {}), name: String(f.get(`v${n}.name`)), sku: String(f.get(`v${n}.sku`)), costMinor: readMoney(f, `v${n}.cost`), priceMinor: readMoney(f, `v${n}.price`), discountMinor: optionalMoney(f, `v${n}.discount`), commissionMinor: optionalMoney(f, `v${n}.commission`), stock: Number(f.get(`v${n}.stock`)), lowStock: Number(f.get(`v${n}.lowStock`)), active: f.has(`v${n}.active`) })),
      }, result => onSaved((result as { id: string }).id));
    } catch (e) { m.setError(e instanceof Error ? e.message : "Məlumatları yoxlayın."); }
  }
  async function uploadFiles(files: FileList | null) {
    if (!product || !files) return; setUploading(true);
    try { for (const file of files) { const key = await upload(file); await api("images", { action: "attach", productId: product.id, key, alt: product.name }); } router.refresh(); }
    catch (e) { images.setError(e instanceof Error ? e.message : "Şəkil yüklənmədi."); } finally { setUploading(false); }
  }
  return <section className="panel editor-panel"><div className="panel-heading"><h2>{product ? "Məhsulu redaktə et" : duplicate ? "Məhsulun surətini yarat" : "Yeni məhsul əlavə et"}</h2><button className="icon-btn" type="button" aria-label="Formanı bağla" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit} className="editor-form"><div className="form-grid"><Field label="Məhsulun adı" name="name" value={source?.name} required maxLength={160} /><Field label="URL adı (slug)" name="slug" value={duplicate ? `${duplicate.slug}-copy` : product?.slug} required hint="Kiçik latın hərfləri və tire: mikrofiber-desmal" /><Field label="Kateqoriya"><select name="categoryId" defaultValue={source?.categoryId} required><option value="">Kateqoriya seçin</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></Field><Field label="Məhsul statusu"><select name="status" defaultValue={product?.status ?? "DRAFT"}><option value="DRAFT">Qaralama</option><option value="PUBLISHED">Yayımlanıb</option><option value="ARCHIVED">Arxiv</option></select></Field><label className="field span-2">Məhsul təsviri<textarea name="description" rows={4} defaultValue={source?.description} maxLength={10000} /></label><Field label="SEO başlığı" name="seoTitle" value={source?.seoTitle ?? ""} maxLength={180} /><Field label="SEO təsviri" name="seoDescription" value={source?.seoDescription ?? ""} maxLength={300} /><label className="checkbox-line"><input name="featured" type="checkbox" defaultChecked={source?.featured} /> Seçilmiş məhsul</label></div><div className="subsection-heading"><h3>Variantlar və qiymətlər</h3><button type="button" className="text-link" onClick={() => setVariants([...variants, { name: "", lowStock: 5, active: true, stock: 0 }])}><Plus size={15} /> Variant əlavə et</button></div>{variants.map((v, n) => <fieldset className="variant-fields" key={v.id ?? n}><legend>Variant {n + 1}</legend><div className="form-grid three"><Field label="Variant adı" name={`v${n}.name`} value={v.name} required /><Field label="SKU" name={`v${n}.sku`} value={v.sku} required /><Field label="Stok sayı" name={`v${n}.stock`} value={v.stock ?? 0} type="number" min={v.reserved ?? 0} required /><MoneyField label="Alış maya dəyəri" name={`v${n}.cost`} minor={v.costMinor} /><MoneyField label="Satış qiyməti" name={`v${n}.price`} minor={v.priceMinor} /><MoneyField label="Endirimli qiymət" name={`v${n}.discount`} minor={v.discountMinor} required={false} /><MoneyField label="Fərdi sifariş komissiyası" name={`v${n}.commission`} minor={v.commissionMinor} required={false} /><Field label="Az stok həddi" name={`v${n}.lowStock`} value={v.lowStock ?? 5} type="number" min={0} required /><label className="checkbox-line"><input name={`v${n}.active`} type="checkbox" defaultChecked={v.active} /> Variant aktivdir</label></div></fieldset>)}<MutationFeedback {...m} /><SaveButton busy={m.busy} /></form><div className="image-editor"><h3>Məhsul şəkilləri</h3><p className="form-hint">Əvvəl məhsulu saxlayın, sonra JPG, PNG və ya WebP əlavə edin. Hər fayl ən çox 4 MB.</p>{product && <><label className="upload-button"><Upload size={18} />{uploading ? "Yüklənir…" : "Şəkilləri yüklə"}<input aria-label="Məhsul şəkilləri" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => uploadFiles(e.target.files)} /></label><div className="admin-image-grid">{product.images.map(i => <div key={i.id}><Image src={`/api/media/${i.key}`} alt={i.alt} width={120} height={120} unoptimized /><button className="icon-btn" aria-label="Şəkli sil" onClick={() => images.run({ action: "delete", key: i.key })}><Trash2 size={15} /></button></div>)}</div></>}<MutationFeedback {...images} /></div></section>;
}
