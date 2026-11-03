"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { csv as makeCsv } from "@/lib/csv";
import { money } from "@/lib/money";
import { MAX_PRODUCT_CSV_BYTES, MAX_PRODUCT_CSV_ROWS, PRODUCT_CSV_HEADERS } from "@/lib/product-csv";
import type { ProductImportPreview, ProductImportResult } from "@/lib/product-import";
import { Table } from "./dashboard-ui";

async function requestImport(data: unknown) {
  const response = await fetch("/api/admin/product-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (response.status === 413) throw new Error("CSV faylı çox böyükdür. Ən çox 512 KB seçin.");
  let result; try { result = await response.json(); } catch { throw new Error("İdxal cavabı alınmadı. Yenidən cəhd edin."); }
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "İdxal alınmadı.");
  return result;
}
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([makeCsv([PRODUCT_CSV_HEADERS])], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "mehsul-idxal-sablonu.csv";
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export function ProductCsvImport({ categories, onClose }: { categories: { id: string; name: string; slug: string }[]; onClose: () => void }) {
  const router = useRouter(); const [file, setFile] = useState<File | null>(null), [category, setCategory] = useState("");
  const [preview, setPreview] = useState<ProductImportPreview | null>(null), [result, setResult] = useState<ProductImportResult | null>(null);
  const [content, setContent] = useState(""), [key, setKey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  function reset() { setPreview(null); setResult(null); setContent(""); setKey(""); setError(""); }
  async function checkFile() {
    reset(); if (!file) { setError("CSV faylı seçin."); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Excel və ya Google Sheets-dən CSV UTF-8 faylı yükləyin."); return; }
    if (file.size > MAX_PRODUCT_CSV_BYTES) { setError("CSV faylı ən çox 512 KB ola bilər."); return; }
    setBusy(true);
    try {
      let text: string; try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error("Faylı CSV UTF-8 formatında yenidən saxlayın."); }
      const checked = await requestImport({ mode: "preview", csv: text, defaultCategoryId: category || undefined }) as ProductImportPreview;
      setContent(text); setKey(crypto.randomUUID()); setPreview(checked);
    } catch (e) { setError(e instanceof Error ? e.message : "CSV faylı yoxlanılmadı."); } finally { setBusy(false); }
  }
  async function save() {
    if (!preview || preview.issues.length || !key || result) return;
    setBusy(true); setError("");
    try {
      const saved = await requestImport({ mode: "import", csv: content, defaultCategoryId: category || undefined, idempotencyKey: key }) as ProductImportResult;
      setResult(saved); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "İdxal saxlanılmadı."); } finally { setBusy(false); }
  }
  return <section className="panel editor-panel csv-import" aria-labelledby="csv-import-title">
    <div className="panel-heading"><h2 id="csv-import-title"><FileSpreadsheet size={20} /> CSV ilə məhsul əlavə et</h2><button type="button" className="icon-btn" aria-label="CSV idxalını bağla" onClick={onClose} disabled={busy}><X size={18} /></button></div>
    <p>Excel və ya Google Sheets cədvəlinizi CSV UTF-8 kimi saxlayın. Bir dəfəyə ən çox {MAX_PRODUCT_CSV_ROWS} sətir və 512 KB qəbul edilir.</p>
    <div className="catalog-actions"><button type="button" className="btn btn-outline btn-small" onClick={downloadTemplate}><Download size={16} /> CSV şablonunu yüklə</button></div>
    <details className="csv-help"><summary>Sütunlar və doldurma qaydaları</summary><p><strong>Tələb olunur:</strong> Məhsul, SKU, Satış AZN, Maya AZN, Stok. Qiymətləri 14.99 və ya 14,99 kimi, stoku tam ədəd kimi yazın. Boş qiymət və stok qəbul edilmir.</p><p>Kateqoriya sütununa mövcud kateqoriyanın adını və ya URL adını yazın. Sütun boşdursa aşağıdakı ümumi kateqoriya işlədilir. URL adı boşdursa məhsul adından hazırlanır. Təsvir və Endirim AZN istəyə bağlıdır; Variant boşdursa Standart seçilir.</p><p>Eyni URL adı olan sətirlər bir məhsulun variantlarıdır. Məhsul adı, təsvir və kateqoriya eyni, variant adları və SKU-lar fərqli olmalıdır. İngilis başlıqları da qəbul edilir: name, sku, price, cost, stock, category, description, slug, variant, discount.</p></details>
    <div className="form-grid"><label className="field">CSV faylı<input aria-label="CSV faylı" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { reset(); setFile(e.target.files?.[0] ?? null); }} /></label><label className="field">Ümumi kateqoriya<select aria-label="Ümumi kateqoriya" value={category} disabled={busy} onChange={e => { reset(); setCategory(e.target.value); }}><option value="">CSV-dəki kateqoriyadan istifadə et</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>)}</select></label></div>
    <p className="form-hint">Bütün məhsullar qaralama kimi saxlanılır. Mövcud SKU və URL adları idxal olunmur. Şəkilləri idxaldan sonra məhsul redaktorunda yükləyə bilərsiniz.</p>
    <button type="button" className="btn btn-outline" disabled={busy || !file} onClick={checkFile}>{busy ? "Gözləyin…" : "Faylı yoxla"}</button>
    <p className="error-message" role={error ? "alert" : undefined}>{error}</p>
    {preview && !result && <div className="csv-preview"><h3>İdxal önizləməsi</h3><p>{preview.productCount} məhsul · {preview.variantCount} variant · Qaralama</p>
      {preview.issues.length > 0 && <div className="error-message" role="alert"><p>Faylda {preview.issues.length} xəta var. Düzəliş edib yenidən yoxlayın; heç bir məhsul saxlanılmayıb.</p><ul>{preview.issues.map((issue, i) => <li key={i}>Sətir {issue.line}: {issue.message}</li>)}</ul></div>}
      {preview.rows.length > 0 && <div className="csv-preview-table"><Table headers={["Sətir", "Məhsul", "Variant / SKU", "Kateqoriya", "Satış", "Maya", "Stok"]}>{preview.rows.map(row => <tr key={row.line}><td>{row.line}</td><td>{row.name}</td><td>{row.variant}<small>{row.sku}</small></td><td>{row.category}</td><td>{money(row.priceMinor)}</td><td>{money(row.costMinor)}</td><td>{row.stock}</td></tr>)}</Table></div>}
      <button type="button" className="btn btn-dark" disabled={busy || preview.issues.length > 0 || !preview.productCount} onClick={save}>{busy ? "Əlavə edilir…" : "Qaralamaları əlavə et"}</button>
    </div>}
    {result && <p className="success-message" role="status">{result.productCount} məhsul və {result.variantCount} variant qaralama kimi əlavə edildi. Məhsulları yoxlayıb şəkillərini əlavə etdikdən sonra yayımlaya bilərsiniz.</p>}
  </section>;
}
