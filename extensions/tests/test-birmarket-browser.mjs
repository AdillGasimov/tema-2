// Browser checks with a Chrome-API adapter. Native MV3 loading is tested separately.
import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractBirmarketProduct } from "../birmarket-product-exporter/extractor.js";
import { extractTemuProduct } from "../birmarket-product-exporter/temu-extractor.js";
import { fullCsv, normalizeProduct } from "../birmarket-product-exporter/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../birmarket-product-exporter");
const snapshot = await readFile(process.env.BIRMARKET_HTML || "/tmp/birmarket-product-2850424.html", "utf8");
const html = snapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, s => /type=["']application\/ld\+json["']/.test(s) ? s : "").replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
const url = "https://birmarket.az/product/2850424-avtomobil-uchun-desmal-no-brand-mikrofiber-nemin-hopdurulmasi-boz-yashil";
const fallback = '<!doctype html><main data-info="product-page"><h1>Dəsmal, &quot;xüsusi&quot;</h1><meta property="product:price:amount" content="5.50"><meta property="product:price:currency" content="AZN"><script type="application/ld+json">{"@type":"Product","sku":"888888","name":"Wrong recommendation","image":"https://wrong.example/other.jpg"}</script><div data-info="product-gallery"><img src="https://strgimgr.b-cdn.net/img/product/280/fallback.jpeg"><img src="https://strgimgr.b-cdn.net/img/product/1680/fallback.jpeg"><img src="data:image/png,xxx"></div><img src="https://other.example/recommendation.jpg"><table><tr data-info="product-features-row"><td data-info="product-features-name">Material:</td><td data-info="product-features-value">Mikrofiber</td></tr></table></main>';
const temuImage = "https://img.kwcdn.com/product/fancy/e7a47b3a-c07f-4fd8-b295-7077b607d199.jpg";
const temuUrl = `https://www.temu.com/az-en/towel-g-601105384433706.html?top_gallery_url=${encodeURIComponent(temuImage)}&tracking=private`;
// These metadata values are fixtures, not a claim about live Temu pricing.
const temuFixture = `<h1>Temu fixture drying towel</h1><link rel="canonical" href="https://www.temu.com/g-601105384433706.html"><script type="application/ld+json">${JSON.stringify([
  { "@type": "Product", sku: "999999", name: "Wrong recommendation", image: "https://img.kwcdn.com/product/fancy/wrong.jpg" },
  { "@type": "Product", url: "https://www.temu.com/g-601105384433706.html", name: "Temu fixture drying towel", image: [temuImage, `${temuImage}?imageView2/2/w/400`], offers: { price: "2.99", priceCurrency: "USD" }, additionalProperty: [{ name: "Material", value: "Fixture microfiber" }] }
])}</script><img src="https://img.kwcdn.com/product/fancy/unrelated.jpg">`;
let stored = {}, listener, badgeText = "";
globalThis.chrome = {
  storage: { local: { get: async () => structuredClone(stored), set: async value => { stored = structuredClone(value); } } },
  action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async value => { badgeText = value.text; } },
  runtime: { id: "test-extension", onMessage: { addListener: fn => { listener = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
};
await import("../birmarket-product-exporter/background.js");
function message(packet, sender = "test-extension") {
  return new Promise((resolve, reject) => { if (!listener(packet, { id: sender }, resolve)) reject(new Error("Sender rejected")); });
}
const files = new Set(["popup.html", "popup.js", "manager.html", "manager.js", "core.js", "client.js", "extractor.js", "temu-extractor.js", "styles.css"]);
const server = createServer(async (req, res) => {
  const name = new URL(req.url, "http://localhost").pathname.slice(1);
  if (!files.has(name)) { res.writeHead(404); res.end(); return; }
  try { const content = await readFile(path.join(root, name)); res.setHeader("Content-Type", name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/css"); res.end(content); }
  catch { res.writeHead(500); res.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ acceptDownloads: true });
let source, sourceUrl = url, checks = 0;
const pass = text => { checks++; console.log(`PASS ${text}`); };
try {
  await context.route(/^https?:/, route => route.request().url().startsWith(base) ? route.continue() : route.request().url() === temuUrl ? route.fulfill({ contentType: "text/html; charset=utf-8", body: temuFixture }) : route.request().url() === url ? route.fulfill({ contentType: "text/html; charset=utf-8", body: html }) : route.request().url().includes("/product/999999-") ? route.fulfill({ contentType: "text/html; charset=utf-8", body: fallback }) : route.abort());
  await context.exposeBinding("extensionRpc", async (_, packet) => {
    if (packet.op === "message") return message(packet.value);
    if (packet.op === "tab") return { id: 1, url: sourceUrl };
    if (packet.op === "extract") { if (packet.temu) assert.equal(packet.world, "MAIN"); return [{ result: await source.evaluate(packet.temu ? extractTemuProduct : extractBirmarketProduct) }]; }
    throw new Error("Unsupported adapter call");
  });
  await context.addInitScript(() => {
    globalThis.chrome = {
      runtime: { id: "test-extension", getURL: file => `/${file}`, sendMessage: value => globalThis.extensionRpc({ op: "message", value }) },
      tabs: { query: async () => [await globalThis.extensionRpc({ op: "tab" })], get: async () => globalThis.extensionRpc({ op: "tab" }), create: async () => ({}) },
      scripting: { executeScript: async ({ func, world }) => globalThis.extensionRpc({ op: "extract", temu: func.name === "extractTemuProduct", world }) },
      downloads: { download: async ({ url, filename }) => { const a = document.createElement("a"); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); return 1; } },
    };
  });
  source = await context.newPage(); await source.goto(url, { waitUntil: "domcontentloaded" });
  const popup = await context.newPage(); await popup.goto(`${base}/popup.html`);
  await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#count").textContent === "1");
  const item = stored.products[0]; assert.match(item.name, /Mikrofiber/); assert.equal(item.sourcePrice, "20.99"); assert.equal(item.imageUrls.length, 1, JSON.stringify(item.imageUrls));
  assert.ok(item.specifications.some(p => p.name === "Uzunluğu, sm" && p.value === "90")); assert.ok(item.specifications.some(p => p.name === "Eni, sm" && p.value === "60"));
  assert.match(item.imageUrls[0], /\/1680\//); assert.equal(item.price, ""); assert.equal(badgeText, "1");
  pass("downloaded product HTML extracted through the popup flow (Chrome APIs adapted)");
  await mkdir("/workspace/artifacts", { recursive: true }); const artifact = normalizeProduct(item); artifact.price = "14.99";
  await writeFile("/workspace/artifacts/birmarket-product-2850424-full.csv", fullCsv([artifact]), "utf8");
  await writeFile("/workspace/artifacts/birmarket-product-2850424.json", JSON.stringify(artifact, null, 2), "utf8");
  const manager = await context.newPage(); await manager.goto(`${base}/manager.html`); await manager.waitForSelector(".product");
  await manager.click("#export-store"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("məlumat çatışmır"));
  pass("manager blocks store export until actual business values are provided");
  await manager.getByLabel("Satış AZN · 2850424", { exact: true }).fill("14.99");
  await manager.getByLabel("Maya AZN · 2850424", { exact: true }).fill("8.50"); await manager.getByLabel("Stok · 2850424", { exact: true }).fill("12");
  await manager.click("#save"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("yadda saxlanıldı"));
  await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#status").textContent.includes("yadda saxlanıldı"));
  assert.equal(stored.products.length, 1); assert.equal(stored.products[0].price, "14.99"); assert.equal(stored.products[0].stock, "12");
  pass("service-worker logic deduplicates products and preserves edited business data");
  const fullEvent = manager.waitForEvent("download"); await manager.click("#export-full"); const fullDownload = await fullEvent;
  const fullData = await readFile(await fullDownload.path(), "utf8"); assert.ok(fullData.includes('"image_urls"')); assert.ok(fullData.includes("/1680/407af88f"));
  const storeEvent = manager.waitForEvent("download"); await manager.click("#export-store"); const storeDownload = await storeEvent;
  const storeData = await readFile(await storeDownload.path(), "utf8"); assert.ok(storeData.includes('"14.99","8.50","12"')); assert.ok(!storeData.includes('"image_urls"'));
  pass("browser downloads have the expected full and store-compatible CSV data");
  sourceUrl = "https://birmarket.az/product/999999-fallback"; await source.goto(sourceUrl, { waitUntil: "domcontentloaded" });
  await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#count").textContent === "2");
  const other = stored.products.find(p => p.id === "999999"); assert.equal(other.name, 'Dəsmal, "xüsusi"'); assert.equal(other.sourcePrice, "5.50");
  assert.deepEqual(other.imageUrls, ["https://strgimgr.b-cdn.net/img/product/1680/fallback.jpeg"]);
  pass("fallback ignores wrong-product metadata and unrelated/unsafe/duplicate images");
  // Simulate records saved by version 1.0 before adding the new marketplace.
  const previous = stored.products.find(p => p.id === "2850424"); delete previous.marketplace; delete previous.sourceId;
  sourceUrl = temuUrl; await source.goto(sourceUrl, { waitUntil: "domcontentloaded" });
  await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#count").textContent === "3");
  const temu = stored.products.find(p => p.id === "temu-601105384433706");
  assert.equal(temu.name, "Temu fixture drying towel"); assert.equal(temu.sku, "TM-601105384433706"); assert.equal(temu.currency, "USD"); assert.equal(temu.sourcePrice, "2.99");
  assert.equal(temu.price, ""); assert.equal(temu.cost, ""); assert.equal(temu.stock, ""); assert.deepEqual(temu.imageUrls, [temuImage]); assert.ok(!temu.sourceUrl.includes("private"));
  assert.equal(stored.products.find(p => p.id === "2850424").price, "14.99");
  pass("Temu fixture capture uses MAIN-world product data, ignores recommendations, namespaces IDs and preserves version 1.0 records");
  await source.setContent('<h1>Raw state fixture</h1>');
  await source.evaluate(image => {
    globalThis.rawData = { store: { goodsInfo: { goods_id: "601105384433706", goods_name: "State fixture towel", image, salePrice: 12345, properties: [{ name: "Material", value: "Fixture fabric" }] }, account: { email: "not-exported@example.test" } } };
    globalThis.getterCalls = 0;
    Object.defineProperty(globalThis.rawData.store.goodsInfo, "gallery", { get() { globalThis.getterCalls++; throw new Error("Do not invoke page getters"); } });
  }, temuImage);
  const state = await source.evaluate(extractTemuProduct); assert.equal(state.name, "State fixture towel"); assert.equal(state.sourcePrice, ""); assert.ok(!JSON.stringify(state).includes("not-exported")); assert.equal(await source.evaluate(() => globalThis.getterCalls), 0);
  pass("verified Temu page-state fixture reads only product fields and never guesses raw numeric prices or exports account data");
  await source.evaluate(() => { delete globalThis.rawData; });
  await source.setContent(`<h1>Visible photo fixture towel</h1><img src="${temuImage}">`);
  const visual = await source.evaluate(extractTemuProduct); assert.equal(visual.name, "Visible photo fixture towel"); assert.deepEqual(visual.imageUrls, [temuImage]);
  pass("Temu share-link fallback requires the matching photo in the visible product DOM");
  await source.setContent('<h1>Security Verification</h1><script type="application/ld+json">{"@type":"Product","sku":"999999","name":"Wrong recommendation"}</script>');
  await assert.rejects(source.evaluate(extractTemuProduct), /yüklənməyib/);
  pass("unloaded or verification pages and unrelated product metadata are rejected without adding a product");
  sourceUrl = "https://outside.example/product/999999"; await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#status").textContent.includes("məhsul səhifəsini"));
  assert.equal(stored.products.length, 3); pass("unsupported marketplace pages are rejected");
  await manager.reload(); await manager.waitForSelector('.product[data-id="2850424"]'); assert.equal(await manager.getByLabel("Satış AZN · 2850424", { exact: true }).inputValue(), "14.99");
  pass("manager reload keeps the collection through the storage adapter");
  await assert.rejects(message({ type: "clear" }, "outside-extension")); assert.equal(stored.products.length, 3);
  pass("collection worker rejects a foreign extension sender");
  console.log(`${checks} browser checks passed with the Chrome-API adapter; native MV3 loading remains unverified.`);
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
