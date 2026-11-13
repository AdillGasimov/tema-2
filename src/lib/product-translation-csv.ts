import { AppError } from "./errors";
import { csv } from "./csv";
import { MAX_PRODUCT_CSV_BYTES, parseProductCsv, productSlug, readProductCsvDocument, type ProductCsvDocument } from "./product-csv";
import { productTranslationTextSchema, type ProductTranslationInput, type ProductTranslationText } from "./product-translation-schema";

export type TranslationGroup = { id: string; input: ProductTranslationInput; rowIndexes: number[] };
export type TranslationDraft = { document: ProductCsvDocument; groups: TranslationGroup[] };

export function createTranslationDraft(text: string): TranslationDraft {
  const document = readProductCsvDocument(text), parsed = parseProductCsv(text);
  if (parsed.issues.length) throw new AppError(`Sətir ${parsed.issues[0].line}: ${parsed.issues[0].message}`);
  const groups = new Map<string, TranslationGroup & { category: string; variants: Set<string> }>();
  const skus = new Set<string>();
  parsed.rows.forEach((row, index) => {
    if (skus.has(row.variant.sku)) throw new AppError(`SKU faylda təkrarlanır: ${row.variant.sku}.`);
    skus.add(row.variant.sku);
    const input = { name: row.name, description: row.description, shortDescription: row.shortDescription || "" };
    let group = groups.get(row.slug);
    if (!group) {
      group = { id: `product-${groups.size + 1}`, input, rowIndexes: [], category: row.category, variants: new Set() };
      groups.set(row.slug, group);
    }
    if (group.input.name !== input.name || group.input.description !== input.description || group.input.shortDescription !== input.shortDescription || group.category !== row.category) throw new AppError("Eyni məhsulun variantlarında ad, təsvir və kateqoriya eyni olmalıdır.");
    if (group.variants.has(row.variant.name)) throw new AppError("Eyni məhsulun variant adları fərqli olmalıdır.");
    group.variants.add(row.variant.name); group.rowIndexes.push(index);
    if (group.rowIndexes.length > 30) throw new AppError("Bir məhsulda ən çox 30 variant ola bilər.");
  });
  return { document, groups: [...groups.values()].map(({ id, input, rowIndexes }) => ({ id, input, rowIndexes })) };
}

export function translatedProductCsv(draft: TranslationDraft, results: Record<string, ProductTranslationText>): string {
  const headers = [...draft.document.headers], keys = [...draft.document.keys];
  const rows = draft.document.records.map(record => [...record.cells]);
  const columns = { name: "name", description: "description", shortDescription: "short_description", slug: "slug", csvFormat: "furycar_csv_format" };
  for (const [key, label] of Object.entries(columns)) if (!keys.includes(key)) {
    keys.push(key); headers.push(label); rows.forEach(row => row.push(""));
  }
  const slugs = new Set<string>();
  for (const group of draft.groups) {
    const checked = productTranslationTextSchema.safeParse(results[group.id]);
    if (!checked.success) throw new AppError(`${group.input.name}: tərcümə tamamlanmayıb və ya mətn hədlərə uyğun deyil.`);
    const translated = checked.data, slug = productSlug(translated.name);
    if (!slug || slug.length > 180) throw new AppError(`${translated.name}: düzgün URL adı hazırlamaq alınmadı.`);
    if (slugs.has(slug)) throw new AppError(`Tərcümə edilmiş məhsullarda URL adı təkrarlanır: ${slug}. Məhsul adlarını fərqləndirin.`);
    slugs.add(slug);
    for (const index of group.rowIndexes) {
      for (const [key, value] of Object.entries({ ...translated, slug })) rows[index][keys.indexOf(key)] = value;
    }
  }
  const marker = keys.indexOf("csvFormat");
  for (const row of rows) row[marker] = "1";
  // Every leading apostrophe is encoded too, making safe spreadsheet escaping
  // reversible even for a real SKU such as '=CODE or 'CODE.
  const safe = rows.map(row => row.map((cell, i) => i !== marker && (/^[\s]*[=+@\-\t\r]/.test(cell) || cell.startsWith("'")) ? `'${cell}` : cell));
  const prepared = csv([headers, ...safe]);
  if (new TextEncoder().encode(prepared).byteLength > MAX_PRODUCT_CSV_BYTES) throw new AppError("Tərcümə edilmiş CSV 512 KB həddini keçir. Faylı kiçik hissələrə bölün.", 413);
  const verified = parseProductCsv(prepared);
  if (verified.issues.length) throw new AppError(`Tərcümə edilmiş CSV, sətir ${verified.issues[0].line}: ${verified.issues[0].message}`);
  return prepared;
}
