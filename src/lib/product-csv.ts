import { ZodError } from "zod";
import { AppError } from "./errors";
import { toMinor } from "./money";
import { productSchema, variantSchema } from "./validation";
import { productPhotoUrls } from "./product-photo-policy";

export const MAX_PRODUCT_CSV_BYTES = 512 * 1024;
export const MAX_PRODUCT_CSV_ROWS = 200;
export const PRODUCT_CSV_HEADERS = ["Məhsul", "SKU", "Satış AZN", "Maya AZN", "Stok", "Kateqoriya", "Təsvir", "URL adı", "Variant", "Endirim AZN", "image_urls", "Qısa təsvir"];
export type CsvIssue = { line: number; message: string };
export type CsvProductRow = { line: number; name: string; slug: string; description: string; shortDescription?: string; category: string; imageUrls: string[]; variant: ReturnType<typeof variantSchema.parse> };
export type CsvPhotoRow = { line: number; sku: string; imageUrls: string[] };

const aliases: Record<string, string[]> = {
  name: ["Məhsul", "Məhsulun adı", "Ad", "name", "product_name"],
  sku: ["SKU"], price: ["Satış AZN", "Satış qiyməti", "price", "price_azn"],
  cost: ["Maya AZN", "Alış maya dəyəri", "cost", "cost_azn"], stock: ["Stok", "Stok sayı", "stock"],
  category: ["Kateqoriya", "category"], description: ["Təsvir", "description"],
  shortDescription: ["Qısa təsvir", "short_description", "shortDescription", "subtitle"],
  slug: ["URL adı", "slug"], variant: ["Variant", "variant"], discount: ["Endirim AZN", "discount", "discount_azn"],
  imageUrls: ["image_urls", "image_url", "Şəkil URL-ləri"],
};
// These columns belong to the extension's Full CSV. They are never used as
// selling price, cost, stock or descriptions chosen by the owner.
for (const field of ["source_url", "source_price", "source_price_azn", "source_currency", "source_category", "source_description", "brand", "source_sku", "specifications", "source_variants", "scraped_at"]) aliases[field] = [field];
const normalize = (s: string) => s.toLocaleLowerCase("az").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ə/g, "e").replace(/ı/g, "i").replace(/[\s_-]/g, "");
export function productSlug(name: string) {
  const letters: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ğ: "g", ç: "c", ş: "s" };
  return name.toLocaleLowerCase("az").replace(/[əıöüğçş]/g, c => letters[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function records(text: string) {
  let source = text.replace(/^\uFEFF/, "");
  const hint = /^sep=([,;\t])\r?\n/i.exec(source);
  if (hint) source = source.slice(hint[0].length);
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]); let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') { if (quoted && source[i + 1] === '"') i++; else quoted = !quoted; }
    else if (!quoted && /[\r\n]/.test(c)) break;
    else if (!quoted && counts.has(c)) counts.set(c, counts.get(c)! + 1);
  }
  const delimiter = hint?.[1] ?? [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const result: { line: number; cells: string[] }[] = [];
  let cells: string[] = [], field = "", state: "plain" | "quoted" | "closed" = "plain", line = hint ? 2 : 1, start = line;
  const cell = () => { cells.push(field); field = ""; state = "plain"; if (cells.length > 32) throw new AppError("CSV faylında həddən çox sütun var."); };
  const record = () => {
    cell(); if (cells.some(c => c.trim())) result.push({ line: start, cells }); cells = [];
    if (result.length > MAX_PRODUCT_CSV_ROWS + 1) throw new AppError(`Bir dəfəyə ən çox ${MAX_PRODUCT_CSV_ROWS} sətir idxal edin.`);
  };
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (state === "quoted") {
      if (c === '"') { if (source[i + 1] === '"') { field += '"'; i++; } else state = "closed"; }
      else if (c === "\r" || c === "\n") { field += "\n"; if (c === "\r" && source[i + 1] === "\n") i++; line++; }
      else field += c;
    } else if (c === delimiter) cell();
    else if (c === "\r" || c === "\n") { record(); if (c === "\r" && source[i + 1] === "\n") i++; start = ++line; }
    else if (state === "closed") { if (c !== " " && c !== "\t") throw new AppError(`CSV sətir ${line}: bağlanan dırnaqdan sonra ayırıcı gözlənilir.`); }
    else if (c === '"') { if (field) throw new AppError(`CSV sətir ${line}: dırnaqları yoxlayın.`); state = "quoted"; }
    else field += c;
  }
  if (state === "quoted") throw new AppError(`CSV sətir ${start}: dırnaq bağlanmayıb.`);
  if (field || cells.length || state === "closed") record();
  return result;
}

function csvData(text: string, required: string[]) {
  if (new TextEncoder().encode(text).byteLength > MAX_PRODUCT_CSV_BYTES) throw new AppError("CSV faylı ən çox 512 KB ola bilər.", 413);
  if (text.includes("\0")) throw new AppError("CSV UTF-8 formatında olmalıdır.");
  const data = records(text); const header = data.shift();
  if (!header) throw new AppError("CSV faylı boşdur.");
  const keys = header.cells.map(h => Object.keys(aliases).find(k => aliases[k].some(a => normalize(a) === normalize(h))));
  const unknown = header.cells.filter((_, i) => !keys[i]);
  if (unknown.length) throw new AppError(`Tanınmayan sütun: ${unknown.map(s => s.slice(0, 60)).join(", ")}. CSV şablonundan istifadə edin.`);
  if (new Set(keys).size !== keys.length) throw new AppError("CSV başlıqlarında təkrarlanan sütun var.");
  if (required.some(k => !keys.includes(k))) throw new AppError(required.includes("imageUrls") ? "SKU və image_urls sütunları tələb olunur. Əlavədən Tam CSV yüklə seçin." : "Məhsul, SKU, Satış AZN, Maya AZN və Stok sütunları tələb olunur.");
  if (!data.length) throw new AppError("CSV başlıqlarından sonra məhsul sətirləri əlavə edin.");
  return { data, keys };
}
function valuesFor(record: { cells: string[] }, keys: (string | undefined)[]): Record<string, string> {
  if (record.cells.length !== keys.length) throw new AppError("Sütun sayı başlıqlarla uyğun deyil. Vergüllü mətnləri dırnağa alın.");
  return Object.fromEntries(keys.map((k, i) => [k!, record.cells[i].trim()]));
}

export function parseProductCsv(text: string): { rows: CsvProductRow[]; issues: CsvIssue[] } {
  const { data, keys } = csvData(text, ["name", "sku", "price", "cost", "stock"]);
  const rows: CsvProductRow[] = [], issues: CsvIssue[] = [];
  for (const record of data) {
    try {
      const values = valuesFor(record, keys);
      for (const [k, label] of [["name", "Məhsul"], ["sku", "SKU"], ["price", "Satış AZN"], ["cost", "Maya AZN"], ["stock", "Stok"]]) if (!values[k]) throw new AppError(`${label} sahəsi boşdur.`);
      if (!/^\d{1,7}$/.test(values.stock)) throw new AppError("Stok 0–1000000 arası tam ədəd olmalıdır.");
      const meta = productSchema.pick({ name: true, slug: true, description: true, shortDescription: true }).parse({ name: values.name, slug: values.slug || productSlug(values.name), description: values.description || "", ...(values.shortDescription ? { shortDescription: values.shortDescription } : {}) });
      const variant = variantSchema.parse({ name: values.variant || "Standart", sku: values.sku, costMinor: toMinor(values.cost), priceMinor: toMinor(values.price), stock: Number(values.stock), discountMinor: values.discount ? toMinor(values.discount) : null });
      if ((values.category || "").length > 160) throw new AppError("Kateqoriya adı çox uzundur.");
      rows.push({ line: record.line, ...meta, category: values.category || "", imageUrls: productPhotoUrls(values.imageUrls || ""), variant });
    } catch (e) {
      const message = e instanceof ZodError ? "Məhsul adı, URL adı, variant, SKU, qiymətlər və stok hədlərini yoxlayın. Satış qiyməti müsbət, endirim isə satış qiymətindən az olmalıdır." : e instanceof Error ? e.message : "Sətirdəki məlumatları yoxlayın.";
      issues.push({ line: record.line, message });
    }
  }
  return { rows, issues };
}

export function parsePhotoCsv(text: string): { rows: CsvPhotoRow[]; issues: CsvIssue[] } {
  const { data, keys } = csvData(text, ["sku", "imageUrls"]);
  const rows: CsvPhotoRow[] = [], issues: CsvIssue[] = [];
  for (const record of data) {
    try {
      const values = valuesFor(record, keys);
      if (!values.sku || values.sku.length > 80) throw new AppError("SKU boşdur və ya 80 simvoldan çoxdur.");
      const imageUrls = productPhotoUrls(values.imageUrls || "");
      if (!imageUrls.length) throw new AppError("Şəkil keçidi yoxdur. Əlavədən Tam CSV yüklə seçin.");
      rows.push({ line: record.line, sku: values.sku, imageUrls });
    } catch (error) { issues.push({ line: record.line, message: error instanceof Error ? error.message : "Şəkil keçidlərini yoxlayın." }); }
  }
  return { rows, issues };
}
