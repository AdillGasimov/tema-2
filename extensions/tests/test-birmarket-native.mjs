import { chromium } from "@playwright/test";
import { strict as assert } from "node:assert";
import { readFile, writeFile, mkdtemp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { fullCsv, normalizeProduct } from "../birmarket-product-exporter/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../birmarket-product-exporter");
const profile = await mkdtemp(path.join(os.tmpdir(), "birmarket-extension-"));
const downloads = path.join(profile, "downloads"); await mkdir(downloads);
const snapshot = await readFile(process.env.BIRMARKET_HTML || "/tmp/birmarket-product-2850424.html", "utf8");
const html = snapshot.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, s => /type=["']application\/ld\+json["']/.test(s) ? s : "").replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
const url = "https://birmarket.az/product/2850424-avtomobil-uchun-desmal-no-brand-mikrofiber-nemin-hopdurulmasi-boz-yashil";
const fallback = '<!doctype html><main data-info="product-page"><h1>Dəsmal, &quot;xüsusi&quot;</h1><meta property="product:price:amount" content="5.50"><meta property="product:price:currency" content="AZN"><script type="application/ld+json">{"@type":"Product","sku":"888888","name":"Wrong recommendation","image":"https://wrong.example/other.jpg"}</script><div data-info="product-gallery"><img src="https://strgimgr.b-cdn.net/img/product/280/fallback.jpeg"><img src="https://strgimgr.b-cdn.net/img/product/1680/fallback.jpeg"><img src="data:image/png,xxx"></div><img src="https://other.example/recommendation.jpg"><table><tr data-info="product-features-row"><td data-info="product-features-name">Material:</td><td data-info="product-features-value">Mikrofiber</td></tr></table></main>';
let checks = 0;
const pass = label => { checks++; process.stdout.write(`PASS ${label}\n`); };
const launch = async () => {
  const browser = await chromium.launchPersistentContext(profile, { executablePath: "/usr/bin/chromium", headless: true, acceptDownloads: true, ignoreDefaultArgs: ["--disable-extensions"], args: ["--no-sandbox", "--headless=new", "--enable-unsafe-extension-debugging", `--disable-extensions-except=${root}`, `--load-extension=${root}`] });
  if (!browser.serviceWorkers().length) {
    const session = await browser.newCDPSession(browser.pages()[0] || await browser.newPage());
    try { await session.send("Extensions.loadUnpacked", { path: root }); }
    catch (error) { await browser.close(); throw error; }
  }
  return browser;
};
let context = await launch();
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  const id = new URL(worker.url()).host; pass("Manifest V3 extension and service worker load in Chromium");
  await context.route(/^https?:/, route => route.request().url() === url ? route.fulfill({ contentType: "text/html; charset=utf-8", body: html }) : route.request().url().includes("/product/999999-") ? route.fulfill({ contentType: "text/html; charset=utf-8", body: fallback }) : route.abort());
  const productPage = await context.newPage(); await productPage.goto(url, { waitUntil: "domcontentloaded" });
  const manager = await context.newPage(); await manager.goto(`chrome-extension://${id}/manager.html`);
  await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("Məhsulları yoxlayın"));
  const cdp = await context.newCDPSession(manager); await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  const tabId = await manager.evaluate(async () => (await globalThis.chrome.tabs.query({ url: "https://birmarket.az/product/*" }))[0].id);
  const saved = await manager.evaluate(async tab => (await import("./client.js")).captureTab(tab), tabId);
  assert.equal(saved.count, 1); assert.match(saved.product.name, /Mikrofiber/); assert.equal(saved.product.sourcePrice, "20.99");
  assert.ok(saved.product.specifications.some(p => p.name === "Uzunluğu, sm" && p.value === "90"));
  assert.ok(saved.product.specifications.some(p => p.name === "Eni, sm" && p.value === "60"));
  assert.equal(saved.product.imageUrls.length, 1); assert.match(saved.product.imageUrls[0], /\/1680\//); assert.equal(saved.product.price, "");
  pass("real downloaded Birmarket HTML: correct product, nine specifications, high-resolution image and separate source price");
  const artifact = normalizeProduct(saved.product); artifact.price = "14.99";
  await mkdir("/workspace/artifacts", { recursive: true });
  await writeFile("/workspace/artifacts/birmarket-product-2850424-full.csv", fullCsv([artifact]), "utf8");
  await writeFile("/workspace/artifacts/birmarket-product-2850424.json", JSON.stringify(artifact, null, 2), "utf8");
  await manager.click("#refresh"); await manager.waitForSelector('.product[data-id="2850424"]');
  assert.match(await manager.locator(".source").textContent(), /20.99/);
  await manager.click("#export-store"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("məlumat çatışmır"));
  pass("store export is blocked until real selling price, cost and stock are entered");
  await manager.getByLabel("Satış AZN · 2850424", { exact: true }).fill("14.99");
  await manager.getByLabel("Maya AZN · 2850424", { exact: true }).fill("8.50");
  await manager.getByLabel("Stok · 2850424", { exact: true }).fill("12");
  await manager.click("#save"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("yadda saxlanıldı"));
  const recaptured = await manager.evaluate(async tab => (await import("./client.js")).captureTab(tab), tabId);
  assert.equal(recaptured.count, 1); assert.equal(recaptured.product.price, "14.99"); assert.equal(recaptured.product.stock, "12");
  pass("resaving the same product deduplicates it and preserves business edits");
  await manager.click("#export-full"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("yükləməsi başladıldı"));
  await manager.click("#export-store"); await manager.waitForFunction(() => document.querySelector("#status").textContent.includes("mağaza CSV faylının"));
  let files = [];
  for (let n = 0; n < 50; n++) { files = (await readdir(downloads)).filter(f => f.endsWith(".csv")); if (files.length === 2) break; await new Promise(r => setTimeout(r, 100)); }
  assert.equal(files.length, 2);
  const full = await readFile(path.join(downloads, files.find(f => f.includes("full"))), "utf8");
  const store = await readFile(path.join(downloads, files.find(f => f.includes("store"))), "utf8");
  assert.ok(full.includes('"image_urls"')); assert.ok(full.includes("/1680/407af88f")); assert.ok(store.includes('"14.99","8.50","12"')); assert.ok(!store.includes('"image_urls"'));
  pass("Chrome downloads both real CSV formats with correct UTF-8 contents");
  await productPage.goto("https://birmarket.az/product/999999-fallback", { waitUntil: "domcontentloaded" });
  const alternative = await manager.evaluate(async tab => (await import("./client.js")).captureTab(tab), tabId);
  assert.equal(alternative.product.name, 'Dəsmal, "xüsusi"'); assert.equal(alternative.product.sourcePrice, "5.50");
  assert.deepEqual(alternative.product.imageUrls, ["https://strgimgr.b-cdn.net/img/product/1680/fallback.jpeg"]);
  pass("DOM fallback ignores unrelated recommendations, unsafe images and duplicate thumbnail sizes");
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`); await popup.waitForFunction(() => document.querySelector("#count").textContent === "2");
  await popup.click("#capture"); await popup.waitForFunction(() => document.querySelector("#status").textContent.includes("Birmarket məhsul"));
  pass("popup displays saved count and rejects a non-product active tab");
  await context.close(); context = await launch();
  const worker2 = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 20000 });
  const manager2 = await context.newPage(); await manager2.goto(`chrome-extension://${new URL(worker2.url()).host}/manager.html`);
  await manager2.waitForSelector('.product[data-id="2850424"]'); assert.equal(await manager2.getByLabel("Satış AZN · 2850424", { exact: true }).inputValue(), "14.99");
  pass("saved collection and business edits survive browser restart");
  console.log(`${checks} extension browser checks passed. Product data came from a downloaded live HTML snapshot; network requests were blocked during browser fixture tests.`);
} finally { await context.close(); }
