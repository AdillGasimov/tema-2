import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { csv } from "../../src/lib/csv";
import { parseProductCsv } from "../../src/lib/product-csv";

const fixture = () => JSON.parse(readFileSync(".local/e2e.json", "utf8")) as { run: string; email: string; password: string };
const headers = { Origin: "http://localhost:3100" };
const image = "https://img.kwcdn.com/product/fancy/e7a47b3a-c07f-4fd8-b295-7077b607d199.jpg";
async function login(page: Page) {
  const f = fixture(); await page.goto("/login");
  await page.getByLabel("E-poçt və ya referal kodu", { exact: true }).fill(f.email);
  await page.getByLabel("Parol", { exact: true }).fill(f.password);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(r => r.url().includes("/api/auth/sign-in/email") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Daxil ol", exact: true }).click(); const result = await response;
    if (result.status() === 429) { await page.waitForTimeout(11000); continue; }
    expect(result.ok()).toBe(true); await page.waitForURL("/admin"); return;
  }
  throw new Error("Local test login remained rate limited.");
}
async function openImporter(page: Page) {
  await login(page); await page.goto("/admin/products");
  const data = await (await page.request.get("/api/admin/products")).json();
  await page.getByRole("button", { name: "CSV idxalı", exact: true }).click();
  const panel = page.locator(".csv-import");
  await panel.getByLabel("Ümumi kateqoriya", { exact: true }).selectOption(data.categories[0].id);
  return { panel, categories: data.categories as { id: string; name: string }[] };
}

test("CSV Azerbaijani translation retries unfinished text, downloads a reusable file and saves exact grouped drafts", async ({ page }) => {
  const f = fixture(), { panel, categories } = await openImporter(page);
  const spray = { name: `Buğulanma əleyhinə şüşə spreyi — 50 ml ${f.run}`, shortDescription: "Şüşələr üçün 50 ml həcmli sprey.", description: "Şüşələr üçün buğulanma əleyhinə sprey. Həcm: 50 ml." };
  const cloth = { name: `Mikrofiber dəsmal — 40 × 60 sm ${f.run}`, shortDescription: "40 × 60 sm ölçülü mikrofiber dəsmal.", description: "Mikrofiber dəsmal. Ölçü: 40 × 60 sm." };
  const calls: string[] = []; let clothAttempts = 0;
  await page.route("**/api/admin/product-translate", async route => {
    const input = route.request().postDataJSON();
    expect(Object.keys(input).sort()).toEqual(["description", "name", "shortDescription"]);
    calls.push(input.name);
    if (input.name.startsWith("Glass")) await route.fulfill({ json: spray });
    else if (++clothAttempts === 1) await route.fulfill({ status: 503, json: { error: "Tərcümə xidməti müvəqqəti əlçatan deyil." } });
    else await route.fulfill({ json: cloth });
  });
  const text = csv([["name", "sku", "price", "cost", "stock", "variant", "description", "slug", "image_urls"],
    [`Glass spray 50 ml ${f.run}`, `TM-SPRAY-A-${f.run}`, "14,99", "5.00", "7", "Yaşıl", "Glass spray, 50 ml.", `supplier-spray-${f.run}`, image],
    [`Glass spray 50 ml ${f.run}`, `TM-SPRAY-B-${f.run}`, "15.99", "6.00", "4", "Boz", "Glass spray, 50 ml.", `supplier-spray-${f.run}`, image],
    [`Microfiber cloth 40 x 60 cm ${f.run}`, `TM-CLOTH-${f.run}`, "19.99", "7.00", "5", "Standart", "Microfiber cloth, 40 x 60 cm.", `supplier-cloth-${f.run}`, ""]]);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "supplier-products.csv", mimeType: "text/csv", buffer: Buffer.from(text) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("müvəqqəti əlçatan deyil");
  await expect(panel.getByText("1 / 2 məhsul tərcümə edildi.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true })).toHaveCount(0);
  expect(calls).toHaveLength(2);
  await panel.getByRole("button", { name: "Tərcüməyə davam et", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "İdxal önizləməsi", exact: true })).toBeVisible();
  expect(calls).toHaveLength(3); expect(calls.filter(name => name.startsWith("Glass"))).toHaveLength(1);
  await expect(panel.getByText(spray.shortDescription, { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Azərbaycan dilində CSV-ni yüklə", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("supplier-products-az.csv");
  const ready = readFileSync((await file.path())!, "utf8"), parsed = parseProductCsv(ready);
  expect(parsed.issues).toEqual([]); expect(parsed.rows).toHaveLength(3);
  expect(parsed.rows[0]).toMatchObject({ name: spray.name, description: spray.description, shortDescription: spray.shortDescription, imageUrls: [image], variant: { sku: `TM-SPRAY-A-${f.run}`, name: "Yaşıl", priceMinor: 1499, costMinor: 500, stock: 7 } });
  expect(ready).toContain('"14,99"'); expect(ready).toContain('"5.00"');
  expect(parsed.rows[1].variant).toMatchObject({ name: "Boz", priceMinor: 1599, costMinor: 600, stock: 4 });
  expect(parsed.rows[2].variant).toMatchObject({ priceMinor: 1999, costMinor: 700, stock: 5 });
  // A downloaded and explicitly reviewed file must work with all provider calls forbidden.
  await page.unroute("**/api/admin/product-translate");
  let repeatedTranslations = 0;
  await page.route("**/api/admin/product-translate", async route => { repeatedTranslations++; await route.fulfill({ status: 503, json: { error: "Must not retranslate prepared CSV" } }); });
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "supplier-products-az.csv", mimeType: "text/csv", buffer: Buffer.from(ready) });
  await panel.getByLabel("Hazır Azərbaycan dilində CSV-ni yoxlamışam; tərcüməsiz istifadə et", { exact: true }).check();
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "İdxal önizləməsi", exact: true })).toBeVisible();
  expect(repeatedTranslations).toBe(0);
  await expect(panel.getByText(spray.shortDescription, { exact: true })).toBeVisible();
  await panel.getByLabel("Ümumi kateqoriya", { exact: true }).selectOption(categories[1].id);
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "İdxal önizləməsi", exact: true })).toBeVisible();
  expect(calls).toHaveLength(3); expect(repeatedTranslations).toBe(0);
  await panel.screenshot({ path: ".local/csv-translation-2026-11-13/import-preview-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: ".local/csv-translation-2026-11-13/import-preview-mobile.png" });
  const imported = page.waitForRequest(r => r.url().endsWith("/api/admin/product-import") && r.postDataJSON()?.mode === "import");
  await panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true }).click();
  expect((await imported).postDataJSON().csv).toBe(ready);
  await expect(panel.getByRole("status").filter({ hasText: "2 məhsul və 3 variant qaralama kimi əlavə edildi." })).toBeVisible();
  await expect(panel.getByText("1 şəkil əlavə edildi · 0 şəkil artıq mövcud idi · 0 xəta.", { exact: true })).toBeVisible({ timeout: 30000 });
  const data = await (await page.request.get("/api/admin/products")).json();
  const saved = data.products.find((p: { name: string }) => p.name === spray.name);
  expect(saved).toMatchObject({ status: "DRAFT", categoryId: categories[1].id, description: spray.description, shortDescription: spray.shortDescription });
  expect(saved.variants.find((v: { sku: string }) => v.sku === `TM-SPRAY-A-${f.run}`)).toMatchObject({ priceMinor: 1499, costMinor: 500, stock: 7, name: "Yaşıl" });
  expect(saved.images).toHaveLength(1); expect(saved.images[0].alt).toContain(spray.name);
});

test("CSV Azerbaijani translation pauses at the free quota and retains the original file", async ({ page }) => {
  const { panel } = await openImporter(page), f = fixture();
  await page.route("**/api/admin/product-translate", route => route.fulfill({ status: 429, json: { error: "Pulsuz tərcümənin günlük limiti bitib. Daha sonra davam edin." } }));
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "untranslated.csv", mimeType: "text/csv", buffer: Buffer.from(csv([["name", "sku", "price", "cost", "stock"], ["English car cloth", `UNTRANSLATED-${f.run}`, "10", "5", "1"]])) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("günlük limiti");
  expect(await panel.getByLabel("CSV faylı", { exact: true }).evaluate((input: HTMLInputElement) => input.files?.[0]?.name)).toBe("untranslated.csv");
  await expect(panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Azərbaycan dilində CSV-ni yüklə", exact: true })).toHaveCount(0);
});

test("CSV Azerbaijani translation is never requested for a photos-only preview", async ({ page }) => {
  const { panel, categories } = await openImporter(page), f = fixture();
  const sku = `PHOTO-TRANSLATION-${f.run}`;
  expect((await page.request.post("/api/admin/products", { headers, data: { name: "Mikrofiber dəsmal", slug: `photo-translation-${f.run}`, description: "Mikrofiber dəsmal.", categoryId: categories[0].id, status: "DRAFT", featured: false, variants: [{ name: "Standart", sku, priceMinor: 1000, costMinor: 500, stock: 1 }] } })).status()).toBe(200);
  let translations = 0;
  await page.route("**/api/admin/product-translate", async route => { translations++; await route.fulfill({ status: 500, json: { error: "Must not translate photos" } }); });
  await panel.getByLabel("İdxal növü", { exact: true }).selectOption("photos");
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "photos.csv", mimeType: "text/csv", buffer: Buffer.from(csv([["sku", "image_urls"], [sku, image]])) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "İdxal önizləməsi", exact: true })).toBeVisible();
  expect(translations).toBe(0);
});

test("CSV Azerbaijani translation can be stopped and resumed without repeating finished products", async ({ page }) => {
  const { panel } = await openImporter(page), f = fixture();
  const calls: string[] = []; let clothAttempts = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/admin/product-translate", async route => {
    const input = route.request().postDataJSON(); calls.push(input.name);
    if (input.name.startsWith("Cloth") && ++clothAttempts === 1) await pending;
    const name = input.name.startsWith("Spray") ? `Şüşə spreyi ${f.run}` : input.name.startsWith("Cloth") ? `Mikrofiber dəsmal ${f.run}` : `Telefon tutacağı ${f.run}`;
    await route.fulfill({ json: { name, description: name + ".", shortDescription: name + "." } }).catch(() => {});
  });
  const text = csv([["name", "sku", "price", "cost", "stock"], ["Spray", `STOP-A-${f.run}`, "10", "5", "1"], ["Cloth", `STOP-B-${f.run}`, "15", "6", "2"], ["Holder", `STOP-C-${f.run}`, "20", "7", "3"]]);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "stop.csv", mimeType: "text/csv", buffer: Buffer.from(text) });
  try {
    await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
    await expect(panel.getByText("1 / 3 məhsul tərcümə edildi.", { exact: true })).toBeVisible();
    await expect.poll(() => calls).toEqual(["Spray", "Cloth"]);
    await panel.getByRole("button", { name: "Tərcüməni dayandır", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("dayandırıldı");
    release();
    await panel.getByRole("button", { name: "Tərcüməyə davam et", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "İdxal önizləməsi", exact: true })).toBeVisible();
    expect(calls).toEqual(["Spray", "Cloth", "Cloth", "Holder"]);
  } finally { release(); }
});
