import { describe, expect, it } from "vitest";
import { parseProductCsv, readProductCsvDocument } from "../../src/lib/product-csv";
import { createTranslationDraft, translatedProductCsv } from "../../src/lib/product-translation-csv";

// Supplier CSV fixtures must be unescaped input, including unsafe spreadsheet
// cells, so the test can prove the exported format is safe AND reversible.
const sourceCsv = (rows: string[][]) => "\uFEFF" + rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
const headers = ["name", "sku", "price", "cost", "stock", "category", "description", "slug", "variant", "discount", "image_urls", "source_url", "source_currency"];
const image = "https://img.kwcdn.com/product/fancy/translation-test.jpg";
const row = (sku = "TM-1", variant = "Standart") => ["Anti-Fog Glass Spray 50 ml", sku, "14,99", "5.00", "7", "avtomobile-qulluq", 'Spray for glass, "50 ml".\nUse on windows.', "temu-long-supplier-spray-123", variant, "12,99", image, "https://www.temu.com/g-601105384433706.html", "USD"];
const az = { name: "Buğulanma əleyhinə şüşə spreyi — 50 ml", shortDescription: "Şüşələr üçün 50 ml həcmli buğulanma əleyhinə sprey.", description: 'Şüşələr üçün buğulanma əleyhinə sprey.\nHəcm: 50 ml. "Şüşə" səthlərdə istifadə olunur.' };

describe("Azerbaijani CSV preparation", () => {
  it("translates grouped variants once and imports the exact financial, photo and identity values", () => {
    const second = row("TM-2", "Boz"); second[2] = "15.99"; second[4] = "4";
    const draft = createTranslationDraft(sourceCsv([headers, row("TM-1", "Yaşıl"), second]));
    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0].input).toEqual({ name: "Anti-Fog Glass Spray 50 ml", description: 'Spray for glass, "50 ml".\nUse on windows.', shortDescription: "" });
    const ready = translatedProductCsv(draft, { [draft.groups[0].id]: az });
    const parsed = parseProductCsv(ready);
    expect(parsed.issues).toEqual([]); expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({ name: az.name, description: az.description, shortDescription: az.shortDescription, slug: "bugulanma-eleyhine-suse-spreyi-50-ml", category: "avtomobile-qulluq", imageUrls: [image], variant: { sku: "TM-1", name: "Yaşıl", priceMinor: 1499, costMinor: 500, stock: 7, discountMinor: 1299 } });
    expect(parsed.rows[1].variant).toMatchObject({ sku: "TM-2", name: "Boz", priceMinor: 1599, costMinor: 500, stock: 4, discountMinor: 1299 });
    expect(parsed.rows[1].slug).toBe("bugulanma-eleyhine-suse-spreyi-50-ml");
    const document = readProductCsvDocument(ready);
    expect(document.records[0].cells[2]).toBe("14,99");
    expect(document.records[0].cells[3]).toBe("5.00");
    expect(document.records[0].cells[11]).toBe("https://www.temu.com/g-601105384433706.html");
    expect(document.records[0].cells[12]).toBe("USD");
    expect(ready.startsWith("\uFEFF")).toBe(true);
  });

  it.each(["=SUM(1,2)", "+SUPPLIER", "-SUPPLIER", "@SUPPLIER", "'SUPPLIER", "'=SUPPLIER"])("safely exports and reimports identity %s without changing it", sku => {
    const raw = row(sku, "+50 ml");
    const draft = createTranslationDraft(sourceCsv([headers, raw]));
    const ready = translatedProductCsv(draft, { [draft.groups[0].id]: az });
    expect(ready).not.toContain('"+50 ml"');
    const parsed = parseProductCsv(ready);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0].variant).toMatchObject({ sku, name: "+50 ml", priceMinor: 1499 });
    const repeatedDraft = createTranslationDraft(ready);
    const repeated = translatedProductCsv(repeatedDraft, { [repeatedDraft.groups[0].id]: az });
    expect(parseProductCsv(repeated).rows[0].variant.sku).toBe(sku);
  });

  it("preserves already Azerbaijani text when the translator returns it unchanged", () => {
    const raw = row(); raw[0] = "Mikrofiber dəsmal"; raw[6] = "Yumşaq mikrofiber dəsmal.";
    const input = sourceCsv([[...headers, "short_description"], [...raw, "Mikrofiber dəsmal."]]);
    const draft = createTranslationDraft(input);
    const ready = translatedProductCsv(draft, { [draft.groups[0].id]: { name: "Mikrofiber dəsmal", description: "Yumşaq mikrofiber dəsmal.", shortDescription: "Mikrofiber dəsmal." } });
    expect(parseProductCsv(ready).rows[0]).toMatchObject({ name: "Mikrofiber dəsmal", description: "Yumşaq mikrofiber dəsmal.", shortDescription: "Mikrofiber dəsmal.", slug: "mikrofiber-desmal" });
  });

  it("refuses incomplete translations instead of falling back to supplier English", () => {
    const draft = createTranslationDraft(sourceCsv([headers, row()]));
    expect(() => translatedProductCsv(draft, {})).toThrow(/tərcümə/i);
  });

  it("reports translated slug collisions instead of merging distinct products", () => {
    const other = row("TM-2"); other[0] = "Window cloth"; other[7] = "another-supplier-product";
    const draft = createTranslationDraft(sourceCsv([headers, row(), other]));
    expect(draft.groups).toHaveLength(2);
    const text = { name: "Dəsmal", description: "Mikrofiber dəsmal.", shortDescription: "Yumşaq dəsmal." };
    expect(() => translatedProductCsv(draft, { [draft.groups[0].id]: text, [draft.groups[1].id]: text })).toThrow(/URL|təkrarlan/);
  });

  it("rejects invalid financial rows before preparing any translation work", () => {
    const raw = row(); raw[3] = "";
    expect(() => createTranslationDraft(sourceCsv([headers, raw]))).toThrow(/Maya|maya/);
  });

  it("rejects inconsistent source variants before sending text for translation", () => {
    const other = row("TM-2", "Boz"); other[6] = "A different product description";
    expect(() => createTranslationDraft(sourceCsv([headers, row(), other]))).toThrow(/variant|təsvir|məhsul/);
  });

  it("rejects unsupported reversible CSV format versions", () => {
    expect(() => parseProductCsv(sourceCsv([[...headers, "furycar_csv_format"], [...row(), "2"]]))).toThrow(/format/);
  });

  it("does not produce a translated CSV that exceeds the actual UTF-8 import limit", () => {
    const rows = Array.from({ length: 100 }, (_, n) => { const raw = row(`SKU-${n}`); raw[0] = `Cloth ${n}`; raw[6] = "a".repeat(1000); raw[7] = `cloth-${n}`; return raw; });
    const draft = createTranslationDraft(sourceCsv([headers, ...rows]));
    const translated = Object.fromEntries(draft.groups.map((g, n) => [g.id, { name: `Dəsmal ${n}`, description: "ə".repeat(3000), shortDescription: "Yumşaq dəsmal." }]));
    expect(() => translatedProductCsv(draft, translated)).toThrow(/512|böyük/);
  });
});
