"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { csv as makeCsv } from "@/lib/csv";
import { money } from "@/lib/money";
import { MAX_PRODUCT_CSV_BYTES, MAX_PRODUCT_CSV_ROWS, PRODUCT_CSV_HEADERS } from "@/lib/product-csv";
import { createTranslationDraft } from "@/lib/product-translation-csv";
import { finishTranslationSession, reviewedTranslationSession, type TranslationProgress, type TranslationSession } from "@/lib/product-translation-session";
import type { ProductTranslationInput, ProductTranslationText } from "@/lib/product-translation-schema";
import type { ProductImportPreview, ProductImportResult, ProductPhotoJob } from "@/lib/product-import";
import { Table } from "./dashboard-ui";

type PhotoFailure = { job: ProductPhotoJob; message: string };
type PhotoResult = { attached: number; skipped: number; failed: PhotoFailure[] };
async function requestImport(data: unknown, photo = false) {
  const response = await fetch(photo ? "/api/admin/product-import-photo" : "/api/admin/product-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (response.status === 413) throw new Error(photo ? "Şəkil ən çox 4 MB ola bilər." : "CSV faylı çox böyükdür. Ən çox 512 KB seçin.");
  let result; try { result = await response.json(); } catch { throw new Error("İdxal cavabı alınmadı. Yenidən cəhd edin."); }
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "İdxal alınmadı.");
  return result;
}
async function requestTranslation(input: ProductTranslationInput, signal: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/admin/product-translate", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  let result; try { result = await response.json(); } catch { throw new Error("Tərcümə cavabı alınmadı. Yenidən cəhd edin."); }
  if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Tərcümə alınmadı. Yenidən cəhd edin.");
  return result;
}
function downloadPreparedCsv(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${name.replace(/\.csv$/i, "")}-az.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([makeCsv([PRODUCT_CSV_HEADERS])], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "mehsul-idxal-sablonu.csv";
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
export function ProductCsvImport({ categories, onClose }: { categories: { id: string; name: string; slug: string }[]; onClose: () => void }) {
  const router = useRouter(); const [file, setFile] = useState<File | null>(null), [category, setCategory] = useState(""), [kind, setKind] = useState<"products" | "photos">("products");
  const [preview, setPreview] = useState<ProductImportPreview | null>(null), [result, setResult] = useState<ProductImportResult | null>(null);
  const [content, setContent] = useState(""), [key, setKey] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [photoResult, setPhotoResult] = useState<PhotoResult | null>(null), [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const session = useRef<{ source: string; translation: TranslationSession } | null>(null), controller = useRef<AbortController | null>(null), mounted = useRef(true);
  const [reviewed, setReviewed] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null), [review, setReview] = useState<ProductTranslationText[]>([]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  function reset(keepTranslation = false) {
    setPreview(null); setResult(null); setContent(""); setKey(""); setError(""); setPhotoResult(null); setProgress(null);
    if (!keepTranslation) { session.current = null; setTranslationProgress(null); setReview([]); }
  }
  async function checkFile() {
    reset(kind === "products"); if (!file) { setError("CSV faylı seçin."); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Excel və ya Google Sheets-dən CSV UTF-8 faylı yükləyin."); return; }
    if (file.size > MAX_PRODUCT_CSV_BYTES) { setError("CSV faylı ən çox 512 KB ola bilər."); return; }
    setBusy(true);
    const attempt = new AbortController(); controller.current = attempt;
    try {
      let text: string; try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error("Faylı CSV UTF-8 formatında yenidən saxlayın."); }
      if (kind === "products") {
        if (!session.current || session.current.source !== text) session.current = { source: text, translation: reviewed ? reviewedTranslationSession(text) : { draft: createTranslationDraft(text), results: {} } };
        const current = session.current.translation;
        text = await finishTranslationSession(current, requestTranslation, { signal: attempt.signal, onProgress: value => {
          if (!mounted.current) return;
          setTranslationProgress(value);
          setReview(current.draft.groups.flatMap(group => current.results[group.id] ? [current.results[group.id]] : []));
        } });
      }
      attempt.signal.throwIfAborted();
      if (!mounted.current) return;
      setContent(text);
      const checked = await requestImport({ mode: "preview", kind, csv: text, defaultCategoryId: category || undefined }) as ProductImportPreview;
      if (mounted.current && !attempt.signal.aborted) { setKey(crypto.randomUUID()); setPreview(checked); }
    } catch (e) {
      if (mounted.current) setError(attempt.signal.aborted ? "Tərcümə dayandırıldı. Hazır nəticələr saxlanıldı; davam edə bilərsiniz." : e instanceof Error ? e.message : "CSV faylı yoxlanılmadı.");
    } finally {
      if (controller.current === attempt) controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  async function savePhotos(jobs: ProductPhotoJob[], previous?: PhotoResult) {
    let attached = previous?.attached ?? 0, skipped = previous?.skipped ?? 0;
    const failed: PhotoFailure[] = [];
    setPhotoResult(null); setProgress({ done: 0, total: jobs.length });
    for (let i = 0; i < jobs.length; i++) {
      const started = Date.now();
      try {
        const saved = await requestImport(jobs[i], true) as { attached: boolean };
        if (saved.attached) attached++; else skipped++;
      } catch (e) { failed.push({ job: jobs[i], message: e instanceof Error ? e.message : "Şəkil əlavə edilmədi." }); }
      setProgress({ done: i + 1, total: jobs.length });
      // Keep downloads sequential and below the per-minute request budget.
      if (i < jobs.length - 1) await new Promise(resolve => setTimeout(resolve, Math.max(0, 600 - (Date.now() - started))));
    }
    setPhotoResult({ attached, skipped, failed }); setProgress(null); router.refresh();
  }
  async function save() {
    if (!preview || preview.issues.length || !key || result) return;
    setBusy(true); setError("");
    try {
      const saved = kind === "products" ? await requestImport({ mode: "import", csv: content, defaultCategoryId: category || undefined, idempotencyKey: key }) as ProductImportResult : { productCount: preview.productCount, variantCount: preview.variantCount };
      setResult(saved);
      if (preview.photos.length) await savePhotos(preview.photos);
      else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "İdxal saxlanılmadı."); } finally { setBusy(false); }
  }
  async function retryPhotos() {
    if (!photoResult?.failed.length) return;
    setBusy(true); try { await savePhotos(photoResult.failed.map(f => f.job), photoResult); } finally { setBusy(false); }
  }
  return <section className="panel editor-panel csv-import" aria-labelledby="csv-import-title">
    <div className="panel-heading"><h2 id="csv-import-title"><FileSpreadsheet size={20} /> CSV ilə məhsul əlavə et</h2><button type="button" className="icon-btn" aria-label="CSV idxalını bağla" onClick={onClose} disabled={busy}><X size={18} /></button></div>
    <p>Birmarket və Temu məhsullarını şəkilləri ilə CSV-dən əlavə edin. Yeni məhsulların adları və təsvirləri avtomatik Azərbaycan dilinə çevrilir. Əlavədə <strong>Tam CSV yüklə</strong> seçin və ya aşağıdakı şablonu doldurun; şəkil keçidləri <strong>image_urls</strong> sütununda olmalıdır. Bir dəfəyə ən çox {MAX_PRODUCT_CSV_ROWS} sətir və 512 KB qəbul edilir.</p>
    <div className="catalog-actions"><button type="button" className="btn btn-outline btn-small" onClick={downloadTemplate}><Download size={16} /> CSV şablonunu yüklə</button></div>
    <label className="field">İdxal növü<select aria-label="İdxal növü" value={kind} disabled={busy} onChange={e => { reset(); setReviewed(false); setKind(e.target.value as "products" | "photos"); }}><option value="products">Yeni məhsullar və şəkillər</option><option value="photos">Mövcud məhsullara yalnız şəkil əlavə et (SKU ilə)</option></select></label>
    <details className="csv-help"><summary>Sütunlar və doldurma qaydaları</summary><p><strong>Yeni məhsul üçün tələb olunur:</strong> Məhsul, SKU, Satış AZN, Maya AZN, Stok. Qiymətləri 14.99 və ya 14,99 kimi, stoku tam ədəd kimi yazın. Boş qiymət və stok qəbul edilmir. Satış qiymətini və maya dəyərini AZN ilə özünüz doldurun. Temu-nun USD və ya digər valyutadakı qiyməti avtomatik AZN-ə çevrilmir.</p><p>Kateqoriya sütununa mövcud kateqoriyanın adını və ya URL adını yazın. Sütun boşdursa aşağıdakı ümumi kateqoriya işlədilir. URL adı boşdursa məhsul adından hazırlanır. Təsvir, Qısa təsvir və Endirim AZN istəyə bağlıdır; Variant boşdursa Standart seçilir.</p><p>Eyni URL adı olan sətirlər bir məhsulun variantlarıdır. Məhsul adı, təsvir və kateqoriya eyni, variant adları və SKU-lar fərqli olmalıdır. İngilis başlıqları da qəbul edilir: name, sku, price, cost, stock, category, description, short_description, slug, variant, discount.</p><p><strong>Şəkillər:</strong> image_urls sütununda Birmarket və ya Temu şəkil keçidlərini | işarəsi ilə ayırın. Bir məhsulda ən çox 12 şəkil, hər şəkil ən çox 4 MB ola bilər. Şəkillər mağazanın yaddaşına köçürülür. Tam CSV faylındakı digər mənbə sütunları saxlanılmır. Yalnız şəkil idxalı üçün SKU və image_urls kifayətdir.</p></details>
    <div className="form-grid"><label className="field">CSV faylı<input aria-label="CSV faylı" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { reset(); setReviewed(false); setFile(e.target.files?.[0] ?? null); }} /></label>{kind === "products" && <label className="field">Ümumi kateqoriya<select aria-label="Ümumi kateqoriya" value={category} disabled={busy} onChange={e => { reset(true); setCategory(e.target.value); }}><option value="">CSV-dəki kateqoriyadan istifadə et</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>)}</select></label>}</div>
    <p className="form-hint">{kind === "products" ? "Yeni məhsullar qaralama kimi saxlanılır. Mövcud SKU və URL adları bu rejimdə idxal olunmur." : "Məhsullar SKU ilə tapılır. Qiymət, maya dəyəri, stok, təsvir və yayım statusu dəyişmir. Əvvəl idxal edilmiş şəkillər təkrarlanmır."}</p>
    {kind === "products" && <label className="csv-ready-option"><input type="checkbox" checked={reviewed} disabled={busy || !file} onChange={e => { reset(); setReviewed(e.target.checked); }} />Hazır Azərbaycan dilində CSV-ni yoxlamışam; tərcüməsiz istifadə et</label>}
    <button type="button" className="btn btn-outline" disabled={busy || !file} onClick={checkFile}>{busy ? "Gözləyin…" : "Faylı yoxla"}</button>
    {kind === "products" && <p className="form-hint">Tərcümə pulsuzdur, API açarı lazım deyil. Xidmətin günlük həddi təxminən 5 000 simvoldur; böyük faylları kiçik hissələrə bölün. Mətnləri idxaldan əvvəl yoxlayın. Hazır CSV seçimi yalnız mağazadan yüklədiyiniz və yoxladığınız Azərbaycan dilində fayl üçündür.</p>}
    {kind === "products" && translationProgress && !result && <div className="csv-translation-progress" aria-live="polite"><p>{translationProgress.done} / {translationProgress.total} məhsul tərcümə edildi.</p><progress max={translationProgress.total} value={translationProgress.done} aria-label="Azərbaycan dilinə tərcümənin gedişi" />{busy && translationProgress.done < translationProgress.total && <button type="button" className="text-link" onClick={() => controller.current?.abort()}>Tərcüməni dayandır</button>}</div>}
    <p className="error-message" role={error ? "alert" : undefined}>{error}</p>
    {kind === "products" && !result && <div className="catalog-actions csv-translation-actions">
      {error && translationProgress && <button type="button" className="btn btn-outline" disabled={busy} onClick={checkFile}>Tərcüməyə davam et</button>}
      {content && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => downloadPreparedCsv(content, file?.name || "mehsullar.csv")}><Download size={16} /> Azərbaycan dilində CSV-ni yüklə</button>}
    </div>}
    {kind === "products" && review.length > 0 && !result && <section className="csv-translation-review" aria-labelledby="translation-review-title"><h3 id="translation-review-title">Hazırlanmış mətnlər</h3>{review.map((text, i) => <article key={i}><h4>{text.name}</h4><p>{text.shortDescription}</p><details><summary>Ətraflı təsvir</summary><p>{text.description}</p></details></article>)}</section>}
    {preview && !result && <div className="csv-preview"><h3>İdxal önizləməsi</h3><p>{preview.productCount} məhsul · {preview.variantCount} variant · {preview.photos.length} yeni şəkil{kind === "products" ? " · Qaralama" : ""}</p>
      {kind === "products" && <p className="form-hint">Tərcümə edilmiş adları və təsvirləri, kateqoriyanı və üz şəklini yoxlayın. image_urls sütunundakı ilk şəkil üz şəkli, digərləri məhsul qalereyası olacaq; dəyişiklik üçün CSV-ni düzəldib yenidən yoxlayın.</p>}
      {preview.issues.length > 0 && <div className="error-message" role="alert"><p>Faylda {preview.issues.length} xəta var. Düzəliş edib yenidən yoxlayın; heç bir məhsul saxlanılmayıb.</p><ul>{preview.issues.map((issue, i) => <li key={i}>Sətir {issue.line}: {issue.message}</li>)}</ul></div>}
      {preview.photos.length === 0 && !preview.issues.length && <p className="form-hint">{kind === "products" ? "Bu faylda şəkil keçidləri yoxdur. Şəkillər üçün əlavədən Tam CSV yüklə seçib həmin faylı istifadə edin. Bu faylı təsdiqləsəniz yalnız məhsul məlumatları əlavə ediləcək." : "Bu fayldakı şəkillər artıq məhsullara əlavə edilib."}</p>}
      {preview.rows.length > 0 && <div className="csv-preview-table"><Table headers={["Sətir", kind === "products" ? "Üz şəkli" : "Yeni şəkil", "Məhsul", "Variant / SKU", "Kateqoriya", ...(kind === "products" ? ["Satış", "Maya", "Stok"] : []), "Şəkil"]}>{preview.rows.map(row => {
        const cover = preview.photos.find(photo => photo.sku === row.sku)?.url;
        return <tr key={row.line}><td>{row.line}</td><td>{cover ? <span className="csv-cover-preview"><Image src={cover} alt={`${row.name} — şəkil önizləməsi`} fill sizes="64px" referrerPolicy="no-referrer" unoptimized /></span> : "—"}</td><td>{row.name}</td><td>{row.variant}<small>{row.sku}</small></td><td>{row.category}</td>{kind === "products" && <><td>{money(row.priceMinor!)}</td><td>{money(row.costMinor!)}</td><td>{row.stock}</td></>}<td>{row.imageCount}</td></tr>;
      })}</Table></div>}
      <button type="button" className="btn btn-dark" disabled={busy || preview.issues.length > 0 || !preview.productCount || (kind === "photos" && !preview.photos.length)} onClick={save}>{busy ? "Əlavə edilir…" : kind === "products" ? "Qaralamaları əlavə et" : "Şəkilləri əlavə et"}</button>
    </div>}
    {result && <p className="success-message" role="status">{kind === "products" ? `${result.productCount} məhsul və ${result.variantCount} variant qaralama kimi əlavə edildi. Məhsulları yoxladıqdan sonra yayımlaya bilərsiniz.` : "Məhsulların qiyməti, stoku və statusu qorunub."}</p>}
    {progress && <div className="csv-photo-progress" role="status"><p>Şəkillər köçürülür: {progress.done} / {progress.total}. Bitənə qədər bu pəncərəni bağlamayın.</p><progress aria-label="Şəkil idxalının gedişi" max={progress.total} value={progress.done} /></div>}
    {photoResult && <div className="csv-photo-result"><p role="status">{photoResult.attached} şəkil əlavə edildi · {photoResult.skipped} şəkil artıq mövcud idi · {photoResult.failed.length} xəta.</p>{photoResult.failed.length > 0 && <><p className="form-hint">Əlavə edilmiş məhsullar və şəkillər saxlanılıb. Alınmayan şəkilləri yenidən yoxlaya bilərsiniz.</p><ul className="error-message">{photoResult.failed.map((failure, i) => <li key={i}>{failure.job.sku}: {failure.message}</li>)}</ul><button type="button" className="btn btn-outline" disabled={busy} onClick={retryPhotos}>Alınmayan şəkilləri yenidən yoxla</button></>}</div>}
  </section>;
}
