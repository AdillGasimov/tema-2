import { test } from "node:test";
import assert from "node:assert/strict";
import { productId, normalizeProduct, mergeProduct, updateProduct, storeErrors, fullCsv, storeCsvBatches, STORE_HEADERS } from "../birmarket-product-exporter/core.js";

function product(id = 2850424) {
  return normalizeProduct({ name: 'Mikrofiber dəsmal, "yaşıl"', sourceUrl: `https://birmarket.az/product/${id}-desmal?tracking=1#photo`, sourcePrice: "20.99", currency: "AZN", sourceSku: String(id), description: "Nəmi hopdurur.\nİkinci sətir", imageUrls: ["https://strgimgr.umico.az/img/product/1680/photo.jpeg", "javascript:alert(1)", "data:image/png;base64,xxx"], specifications: [{ name: "Material", value: "Mikrofiber" }] });
}
function ready(id) { return updateProduct(product(id), { price: "14.99", cost: "8.50", stock: "12", category: "desmallar" }); }

test("accepts only HTTPS Birmarket product URLs", () => {
  assert.equal(productId("https://birmarket.az/product/2850424-cloth"), "2850424");
  assert.equal(productId("https://www.birmarket.az/ru/product/2850424-cloth"), "2850424");
  for (const bad of ["https://birmarket.az.evil.example/product/2850424", "http://birmarket.az/product/2850424", "https://user:secret@birmarket.az/product/2850424", "https://birmarket.az/search", "chrome://extensions", "https://birmarket.az:444/product/2850424"]) assert.equal(productId(bad), null);
});
test("normalization keeps source price separate and filters unsafe photo URLs", () => {
  const p = product(); assert.equal(p.sourcePrice, "20.99"); assert.equal(p.price, ""); assert.equal(p.cost, ""); assert.equal(p.stock, "");
  assert.equal(p.sku, "BM-2850424"); assert.match(p.slug, /-2850424$/); assert.equal(p.sourceUrl, "https://birmarket.az/product/2850424-desmal");
  assert.equal(p.imageUrls.length, 1); assert.ok(storeErrors(p).length >= 3);
});
test("resaving updates source fields without losing business edits", () => {
  const edited = ready(2850424); const next = mergeProduct(edited, { ...product(), sourcePrice: "25.99", name: "Yeni mənbə adı" });
  assert.equal(next.sourcePrice, "25.99"); assert.equal(next.price, "14.99"); assert.equal(next.cost, "8.50"); assert.equal(next.stock, "12"); assert.equal(next.storeName, edited.storeName);
});
test("edits cannot replace source identity or inject source images", () => {
  const p = ready(1), edited = updateProduct(p, { id: "999", sourceUrl: "https://evil.example", imageUrls: ["https://evil.example/a"], price: "19.99" });
  assert.equal(edited.id, "1"); assert.equal(edited.sourceUrl, p.sourceUrl); assert.deepEqual(edited.imageUrls, p.imageUrls); assert.equal(edited.price, "19.99");
});
test("full export preserves photo URLs, Unicode, quotes, newlines and source fields", () => {
  const data = fullCsv([product()]); assert.ok(data.startsWith("\uFEFF")); assert.ok(data.includes('"image_urls"')); assert.ok(data.includes('"source_price_azn"'));
  assert.ok(data.includes('"Mikrofiber dəsmal, ""yaşıl"""')); assert.ok(data.includes("İkinci sətir")); assert.ok(data.includes("https://strgimgr.umico.az/img/product/1680/photo.jpeg"));
});
test("spreadsheet formula prefixes are escaped in exported untrusted text", () => {
  const p = product(); p.storeName = '=HYPERLINK("https://example.test")';
  assert.ok(fullCsv([p]).includes("'=HYPERLINK"));
});
test("store export requires actual selling price, cost and stock", () => {
  assert.throws(() => storeCsvBatches([product()]), /məlumat çatışmır/);
  const p = ready(1); assert.deepEqual(storeErrors(p), []); assert.equal(storeCsvBatches([p]).length, 1);
  assert.throws(() => storeCsvBatches([updateProduct(p, { price: "0" })]), /Satış/);
  assert.throws(() => storeCsvBatches([updateProduct(p, { cost: "" })]), /maya/);
  assert.throws(() => storeCsvBatches([updateProduct(p, { stock: "1.5" })]), /Stok/);
  assert.throws(() => storeCsvBatches([updateProduct(p, { discount: "15" })]), /Endirim/);
});
test("explicit zero cost and stock are permitted without being assumed", () => {
  const p = updateProduct(ready(1), { cost: "0", stock: "0" }); assert.deepEqual(storeErrors(p), []);
});
test("store CSV has exactly the supported metadata headers", () => {
  const data = storeCsvBatches([ready(1)])[0]; assert.equal(data.split("\r\n")[0], "\uFEFF" + STORE_HEADERS.map(h => `"${h}"`).join(",")); assert.ok(!data.includes('"image_urls"'));
});
test("large collections export in 50-row batches", () => {
  assert.equal(storeCsvBatches(Array.from({ length: 101 }, (_, n) => ready(n + 1))).length, 3);
});
test("long Unicode descriptions also respect the 512 KiB store file limit", () => {
  const batches = storeCsvBatches(Array.from({ length: 40 }, (_, n) => ({ ...ready(n + 1), descriptionOverride: "ə".repeat(9000) })));
  assert.equal(batches.length, 2); for (const batch of batches) assert.ok(new TextEncoder().encode(batch).byteLength <= 512 * 1024);
});
test("duplicate SKUs and ambiguous variant groups are rejected", () => {
  assert.throws(() => storeCsvBatches([ready(1), { ...ready(2), sku: "BM-1" }]), /SKU/);
  assert.throws(() => storeCsvBatches([{ ...ready(1), slug: "same" }, { ...ready(2), slug: "same" }]), /variant/);
});
test("variant groups never split across CSV batches", () => {
  const standalone = Array.from({ length: 49 }, (_, n) => ready(n + 1));
  const variants = ["Yaşıl", "Boz"].map((variant, i) => ({ ...ready(100 + i), slug: "group", variant }));
  const batches = storeCsvBatches([...standalone, ...variants]); assert.equal(batches.length, 2);
  assert.ok(!batches[0].includes('"group"')); assert.ok(batches[1].includes('"Yaşıl"')); assert.ok(batches[1].includes('"Boz"'));
});

test("Temu IDs are namespaced and tracking URLs are removed while query-only product identity survives", () => {
  assert.equal(productId("https://www.temu.com/az-en/towel-g-601105384433706.html?tracking=x"), "temu-601105384433706");
  assert.equal(productId("https://www.temu.com/g-601105384433706.html"), "temu-601105384433706");
  const p = normalizeProduct({ sourceUrl: "https://www.temu.com/goods.html?goods_id=601105384433706&_x_sessn_id=private#photo", name: "Temu towel", currency: "USD", sourcePrice: "2.99", imageUrls: ["https://img.kwcdn.com/product/fancy/example.jpg"] });
  assert.equal(p.id, "temu-601105384433706"); assert.equal(p.sku, "TM-601105384433706"); assert.equal(p.sourceUrl, "https://www.temu.com/goods.html?goods_id=601105384433706"); assert.equal(p.price, ""); assert.match(p.slug, /^temu-/);
  const data = fullCsv([p]); assert.ok(data.includes('"source_price"')); assert.ok(data.includes('"USD"')); assert.ok(!data.includes("private"));
  const sameNumber = normalizeProduct({ name: "Birmarket towel", sourceUrl: "https://birmarket.az/product/601105384433706-towel" });
  assert.notEqual(p.id, sameNumber.id); assert.notEqual(p.sku, sameNumber.sku);
  const edited = updateProduct(p, { price: "14.99", cost: "7", stock: "5" });
  assert.equal(mergeProduct(edited, { ...p, name: "Updated source" }).price, "14.99");
  for (const bad of ["https://temu.com.evil.test/g-601105384433706.html", "http://www.temu.com/g-601105384433706.html", "https://user:secret@www.temu.com/g-601105384433706.html", "https://www.temu.com/login.html?goods_id=601105384433706", "https://www.temu.com/g-601105384433706.html?goods_id=999999", "https://www.temu.com/search_result.html", "https://share.temu.com/secret"]) assert.equal(productId(bad), null);
});
