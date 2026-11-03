import { describe, expect, it } from "vitest";
import { csv } from "../../src/lib/csv";
import { MAX_PRODUCT_CSV_BYTES, MAX_PRODUCT_CSV_ROWS, parseProductCsv, productSlug } from "../../src/lib/product-csv";

const headers = ["name", "sku", "price", "cost", "stock", "category", "description", "slug", "variant", "discount"];
const row = ["Yaşıl mikrofiber dəsmal", "CLOTH-1", "14.99", "8.50", "12", "desmallar", "Nəmi hopdurur.", "", "Yaşıl", ""];
describe("product CSV files", () => {
  it("reads BOM, Azerbaijani text and exact minor-unit amounts", () => {
    const result = parseProductCsv(csv([headers, row]));
    expect(result.issues).toEqual([]); expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ line: 2, name: row[0], slug: "yasil-mikrofiber-desmal", category: "desmallar", variant: { sku: "CLOTH-1", priceMinor: 1499, costMinor: 850, stock: 12 } });
  });
  it("accepts Azerbaijani headers, Excel sep hints and decimal commas", () => {
    const result = parseProductCsv('\uFEFFsep=;\r\nMəhsul;SKU;Satış AZN;Maya AZN;Stok\r\nDəsmal;X;14,99;8,50;0\r\n');
    expect(result.issues).toEqual([]); expect(result.rows[0]).toMatchObject({ line: 3, variant: { priceMinor: 1499, stock: 0 } });
  });
  it("supports uppercase English headers and tab-separated files", () => {
    const result = parseProductCsv('NAME\tSKU\tPRICE\tCOST\tSTOCK\nDəsmal\tX\t14.99\t0\t1');
    expect(result.issues).toEqual([]); expect(result.rows[0].variant.costMinor).toBe(0);
  });
  it("preserves quoted delimiters, escaped quotes and multiline descriptions with physical line numbers", () => {
    const description = 'Yumşaq, "yaşıl" dəsmal\nİkinci sətir';
    const first = [...row]; first[6] = description;
    const second = [...row]; second[1] = "CLOTH-2";
    const result = parseProductCsv(csv([headers, first, second]));
    expect(result.rows[0].description).toBe(description); expect(result.rows[1].line).toBe(4);
  });
  it.each(['name,sku,price,cost,stock\n"Dəsmal,X,1,0,1', 'name,sku,price,cost,stock\n"Dəsmal"junk,X,1,0,1', 'name,sku,price,cost,stock\nDəs"mal,X,1,0,1'])("rejects malformed quoting without silently changing values", text => {
    expect(() => parseProductCsv(text)).toThrow(/dırnaq|ayırıcı/);
  });
  it("rejects unknown, duplicate and missing headers", () => {
    expect(() => parseProductCsv("name,sku,price,cost,stock,photo_url\nA,X,1,0,1,https://example.test/x")).toThrow("Tanınmayan sütun");
    expect(() => parseProductCsv("name,Məhsul,sku,price,cost,stock\nA,A,X,1,0,1")).toThrow("təkrarlanan");
    expect(() => parseProductCsv("name,sku,price,stock\nA,X,1,1")).toThrow("tələb olunur");
  });
  it("requires explicit cost and stock and reports wrong column counts", () => {
    const result = parseProductCsv("name,sku,price,cost,stock\nDəsmal,A,1,,1\nDəsmal,B,1,0,\nDəsmal,C,1,0,1,extra");
    expect(result.rows).toHaveLength(0); expect(result.issues.map(i => i.line)).toEqual([2, 3, 4]);
  });
  it.each(["-1", "1e2", "1.999", "0"])("rejects invalid selling price %s", price => {
    expect(parseProductCsv(csv([headers, row.map((v, i) => i === 2 ? price : v)])).issues).toHaveLength(1);
  });
  it("rejects fractional/oversized stock and discounts at or above the price", () => {
    for (const [index, value] of [[4, "1.5"], [4, "1000001"], [9, "14.99"]] as const) {
      expect(parseProductCsv(csv([headers, row.map((v, i) => i === index ? value : v)])).issues).toHaveLength(1);
    }
  });
  it("limits rows and UTF-8 byte size and rejects empty or wrong-encoding files", () => {
    const rows = Array.from({ length: MAX_PRODUCT_CSV_ROWS }, (_, i) => row.map((v, n) => n === 1 ? `SKU-${i}` : v));
    expect(parseProductCsv(csv([headers, ...rows])).rows).toHaveLength(MAX_PRODUCT_CSV_ROWS);
    expect(() => parseProductCsv(csv([headers, ...rows, row]))).toThrow("50 sətir");
    expect(() => parseProductCsv("ə".repeat(MAX_PRODUCT_CSV_BYTES / 2 + 1))).toThrow("512 KB");
    expect(() => parseProductCsv("name\0")).toThrow("UTF-8");
    expect(() => parseProductCsv("")).toThrow("boşdur");
    expect(() => parseProductCsv(csv([headers]))).toThrow("məhsul sətirləri");
  });
  it("transliterates Azerbaijani slugs without executing or interpreting cell text", () => {
    expect(productSlug("ÇÖL üçün — Əşya, yaşıl!" )).toBe("col-ucun-esya-yasil");
    const raw = 'name,sku,price,cost,stock,description\nDəsmal,X,1,0,1,"=HYPERLINK(""https://example.test"")"';
    expect(parseProductCsv(raw).rows[0].description).toBe('=HYPERLINK("https://example.test")');
    expect(csv([[parseProductCsv(raw).rows[0].description]])).toContain("'=HYPERLINK");
  });
});
