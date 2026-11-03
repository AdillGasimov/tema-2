import { describe, expect, it } from "vitest";
import { normalizeProduct, updateProduct, storeCsvBatches, fullCsv } from "../../extensions/birmarket-product-exporter/core.js";
import { parseProductCsv } from "../../src/lib/product-csv";

const product = (id: number) => updateProduct(normalizeProduct({ name: `Dəsmal ${id}`, sourceUrl: `https://birmarket.az/product/${id}-desmal`, description: 'Yumşaq, "yaşıl"\nMikrofiber', imageUrls: ["https://strgimgr.umico.az/img/product/1680/example.jpeg"], specifications: [{ name: "Material", value: "Mikrofiber" }] }), { price: "14,99", cost: "8.50", stock: "12", category: "desmallar" });
describe("extension CSV compatibility with the actual shop importer", () => {
  it("exports 101 products in accepted 50/50/1-row files with exact money and stock", () => {
    const files = storeCsvBatches(Array.from({ length: 101 }, (_, n) => product(n + 1)));
    const parsed = files.map(parseProductCsv);
    expect(parsed.map(p => p.rows.length)).toEqual([50, 50, 1]);
    for (const batch of parsed) {
      expect(batch.issues).toEqual([]);
      expect(batch.rows[0].variant).toMatchObject({ priceMinor: 1499, costMinor: 850, stock: 12 });
      expect(batch.rows[0].description).toContain('Yumşaq, "yaşıl"');
    }
  });
  it("keeps photo/source metadata in full exports without misrepresenting them as store CSV", () => {
    const full = fullCsv([product(1)]);
    expect(full).toContain('"image_urls"'); expect(full).toContain("https://strgimgr.umico.az/img/product/1680/example.jpeg");
    expect(() => parseProductCsv(full)).toThrow(/sütun/);
  });
  it("splits Unicode-heavy descriptions to stay inside the actual importer's byte bound", () => {
    const files = storeCsvBatches(Array.from({ length: 40 }, (_, n) => ({ ...product(n + 1), descriptionOverride: "ə".repeat(9000) })));
    expect(files).toHaveLength(2);
    expect(files.map(parseProductCsv).reduce((sum, p) => sum + p.rows.length, 0)).toBe(40);
    for (const batch of files.map(parseProductCsv)) expect(batch.issues).toEqual([]);
  });
});
