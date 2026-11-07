import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const origin = { Origin: "http://localhost:3100" };
const fixture = () => JSON.parse(readFileSync(".local/e2e.json", "utf8")) as { run: string; email: string; password: string; foreignCode: string };
async function signIn(page: Page, identifier: string, password: string) {
  await page.goto("/login"); await page.getByLabel("E-poçt və ya referal kodu", { exact: true }).fill(identifier); await page.getByLabel("Parol", { exact: true }).fill(password);
  for (let n = 0; n < 3; n++) {
    const pending = page.waitForResponse(r => r.url().includes("/api/auth/sign-in/email") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Daxil ol", exact: true }).click(); const response = await pending;
    if (response.status() === 429) { await page.waitForTimeout(Math.min(60, Number(response.headers()["retry-after"]) || 11) * 1000); continue; }
    expect(response.ok()).toBe(true); await page.waitForURL(/\/(admin|partner)/); return;
  }
  throw new Error("Test login remained rate limited.");
}
type ProductInput = { id: string; name: string; slug: string; description: string; shortDescription: string; categoryId: string; featured: boolean; variants: { id: string; name: string; sku: string; costMinor: number; priceMinor: number; stock: number; discountMinor: number | null; commissionMinor: number | null; active: boolean; lowStock: number }[] };
const update = (p: ProductInput, slug = p.slug) => ({ id: p.id, name: p.name, slug, description: p.description, shortDescription: p.shortDescription, categoryId: p.categoryId, status: "PUBLISHED", featured: p.featured,
  variants: p.variants.map(v => ({ id: v.id, name: v.name, sku: v.sku, costMinor: v.costMinor, priceMinor: v.priceMinor, stock: v.stock, discountMinor: v.discountMinor, commissionMinor: v.commissionMinor, active: v.active, lowStock: v.lowStock })) });
let admin: Page, initial: { settings: Record<string, unknown>; rule: unknown };
let single: ProductInput, multi: ProductInput, sold: ProductInput, redirectProduct: ProductInput;
let category: { id: string; slug: string }, filterCategory: { id: string; slug: string };
let secondImage: string;
const suffix = randomUUID().slice(0, 7), filterNames: string[] = [];
const cleanSettings = (s: Record<string, unknown>) => Object.fromEntries(Object.entries(s).filter(([k]) => !["id", "updatedAt"].includes(k)));
test.beforeAll(async ({ browser }) => {
  admin = await browser.newPage(); const f = fixture(); await signIn(admin, f.email, f.password);
  initial = await (await admin.request.get("/api/admin/settings")).json();
  const delivery = JSON.parse(readFileSync("catalog/curation/2026-11-07-content.json", "utf8")).delivery.after;
  expect((await admin.request.post("/api/admin/settings", { headers: origin, data: { settings: { ...cleanSettings(initial.settings), ...delivery, heroImageKey: null, legalName: "", taxId: "", businessAddress: "" }, rule: initial.rule } })).ok()).toBe(true);
  const categories = await (await admin.request.get("/api/admin/categories")).json();
  category = categories.find((c: { name: string }) => c.name === "Ətirləndiricilər");
  if (!category) category = await (await admin.request.post("/api/admin/categories", { headers: origin, data: { name: "Ətirləndiricilər", slug: `audit-etir-${suffix}` } })).json();
  filterCategory = await (await admin.request.post("/api/admin/categories", { headers: origin, data: { name: `Sınaq çeşidi ${suffix}`, slug: `audit-filter-${suffix}` } })).json();
  async function create(label: string, stock: number, prices = [1250], cat = category.id) {
    const response = await admin.request.post("/api/admin/products", { headers: origin, data: { name: `Sınaq məhsulu ${label} ${suffix}`, slug: `audit-${label}-${suffix}`, description: "Azərbaycan dilində ətraflı məhsul məlumatı.", shortDescription: "Azərbaycan dilində qısa məhsul təsviri.", categoryId: cat, status: "PUBLISHED", featured: false,
      variants: prices.map((price, n) => ({ name: n ? "Böyük" : "Standart", sku: `AUD-${suffix}-${label}-${n}`, costMinor: 100, priceMinor: price, stock })) } });
    expect(response.ok()).toBe(true); const result = await response.json();
    const all = await (await admin.request.get("/api/admin/products")).json(); return all.products.find((p: { id: string }) => p.id === result.id) as ProductInput;
  }
  single = await create("single", 2); multi = await create("multi", 3, [1000, 2000]); sold = await create("sold", 0); redirectProduct = await create("redirect", 3);
  for (const color of ["green", "blue"]) {
    const upload = await admin.request.post("/api/admin/upload", { headers: origin, multipart: { file: { name: "test.png", mimeType: "image/png", buffer: await sharp({ create: { width: 30, height: 30, channels: 3, background: color } }).png().toBuffer() } } });
    expect(upload.ok()).toBe(true); const photo = await upload.json(); secondImage = photo.key;
    expect((await admin.request.post("/api/admin/images", { headers: origin, data: { action: "attach", productId: multi.id, key: photo.key, alt: `${multi.name} şəkli` } })).ok()).toBe(true);
  }
  for (let n = 0; n < 14; n++) { const p = await create(`filter-${String(n).padStart(2, "0")}`, 3, n === 13 ? [100, 900] : [100 + n * 10], filterCategory.id); filterNames.push(p.name); }
});
test.afterAll(async () => {
  if (admin && initial) expect((await admin.request.post("/api/admin/settings", { headers: origin, data: { settings: cleanSettings(initial.settings), rule: initial.rule } })).ok()).toBe(true);
  await admin?.close();
});

test("public policies, delivery, footer, category navigation and SEO are complete", async ({ page }) => {
  const titles = new Set<string>(), descriptions = new Set<string>();
  for (const path of ["/", "/privacy", "/terms", "/returns", "/cart", "/products", "/partnership", "/login"]) {
    expect((await page.goto(path))?.status()).toBe(200); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const title = await page.title(); expect(titles.has(title)).toBe(false); titles.add(title);
    const description = await page.locator('meta[name="description"]').getAttribute("content"); expect(description!.length).toBeGreaterThan(50); expect(descriptions.has(description!)).toBe(false); descriptions.add(description!);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `http://localhost:3100${path === "/" ? "" : path}`);
    if (path === "/privacy") expect(await page.locator("main").innerText()).not.toContain("Mağaza sahibi fəaliyyətə başlamazdan əvvəl");
    if (path === "/cart") { await expect(page.locator(".cart-storage-note")).toContainText("yalnız bu cihazdakı"); await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/); }
  }
  await page.goto("/"); await expect(page.getByRole("navigation", { name: "Əsas menyu" }).getByRole("link", { name: "Ətirləndiricilər", exact: true })).toHaveCount(1);
  await expect(page.locator("#delivery")).toContainText("3 iş günü"); await expect(page.locator("#delivery")).toContainText("4 iş günü"); await expect(page.locator("#delivery")).toContainText("pulsuz"); await expect(page.locator("#delivery")).toContainText("5,00"); await expect(page.locator("#delivery")).toContainText("WhatsApp");
  await page.locator('.store-footer a[href="/#delivery"]').click(); await expect(page).toHaveURL(/\/#delivery$/); await expect(page.locator("#delivery")).toBeInViewport();
  for (const path of ["/privacy", "/terms", "/returns"]) { const link = page.locator(`.store-footer a[href="${path}"]`); await expect(link).toBeVisible(); expect((await page.request.get(path)).status()).toBe(200); }
  await expect(page.locator(".footer-business, #business-info")).toHaveCount(0);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content"); const response = await page.request.get(image!); expect(response.status()).toBe(200); expect((await sharp(await response.body()).metadata()).width).toBe(1200);
  const robots = await (await page.request.get("/robots.txt")).text(); expect(robots).toContain("Allow: /api/media/"); expect(robots).toContain("Disallow: /cart"); expect(robots).toContain("sitemap.xml");
  const sitemap = await (await page.request.get("/sitemap.xml")).text(); for (const path of ["/terms", "/returns", "/privacy"]) expect(sitemap).toContain(path);
  await page.goto(`/products?category=${category.slug}`); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ətirləndiricilər"); expect(await page.title()).toContain("Ətirləndiricilər"); expect(titles.has(await page.title())).toBe(false);
});

test("product options, stock limits, gallery, device cart, buy-now and WhatsApp checkout work", async ({ page, browser }) => {
  await page.goto(`/products/${sold.slug}`); await expect(page.locator('.purchase select')).toHaveCount(0); await expect(page.locator('.purchase .out-stock')).toContainText("Stokda yoxdur");
  await expect(page.getByRole("button", { name: "Artır", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Səbətə əlavə et", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "İndi sifariş et", exact: true })).toBeDisabled();
  await page.goto(`/products/${single.slug}`); await expect(page.locator('.purchase select')).toHaveCount(0); await expect(page.locator('.detail-short-description')).toHaveText(single.shortDescription);
  await expect(page.getByRole("button", { name: "Azalt", exact: true })).toBeDisabled(); await page.getByRole("button", { name: "Artır", exact: true }).click(); await expect(page.getByRole("button", { name: "Artır", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Azalt", exact: true }).click(); await page.getByRole("button", { name: "Səbətə əlavə et", exact: true }).click(); await page.getByRole("button", { name: "Səbətə əlavə edildi", exact: true }).click(); await expect(page.getByRole("button", { name: "Səbətə əlavə edildi", exact: true })).toBeDisabled();
  await page.reload(); await page.goto("/cart"); await expect(page.locator(".cart-storage-note")).toBeVisible(); await expect(page.getByRole("button", { name: `${single.name} artır`, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: `${single.name} azalt`, exact: true }).click(); await page.getByRole("button", { name: `${single.name} artır`, exact: true }).click();
  const otherDevice = await browser.newContext(); try { const empty = await otherDevice.newPage(); await empty.goto("http://localhost:3100/cart"); await expect(empty.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible(); } finally { await otherDevice.close(); }
  await page.getByLabel("Referal kodu (istəyə bağlı)", { exact: true }).fill(fixture().foreignCode); await page.getByRole("button", { name: "Kodu tətbiq et" }).click(); await expect(page.locator('.summary-card [role="status"]')).toContainText(fixture().foreignCode);
  await page.getByRole("button", { name: `${single.name} sil`, exact: true }).click(); await expect(page.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible();
  await page.goto(`/products/${multi.slug}`); await expect(page.getByLabel("Variant", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Artır", exact: true }).click(); await page.getByLabel("Variant", { exact: true }).selectOption(multi.variants[1].id); await expect(page.locator('.purchase .quantity-control > span')).toHaveText("1"); await expect(page.locator('.detail-price')).toContainText("20,00");
  await page.getByRole("button", { name: `${multi.name} şəkil 2`, exact: true }).click(); await expect(page.locator('.detail-image img')).toHaveAttribute("src", `/api/media/${secondImage}`);
  await page.getByRole("button", { name: "İndi sifariş et", exact: true }).click(); await expect(page).toHaveURL(/\/checkout$/); await expect(page.locator('.cart-storage-note')).toBeVisible();
  await page.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("28 May (Bakı)"); await expect(page.locator('.summary-line').filter({ hasText: "Çatdırılma" })).toContainText("0,00");
  await page.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("Bakı"); await expect(page.locator('.summary-line').filter({ hasText: "Çatdırılma" })).toContainText("5,00");
  await page.getByLabel("Ad və soyad", { exact: true }).fill("Sınaq alıcısı"); await page.getByLabel("Telefon nömrəsi", { exact: true }).fill("+994500005566"); await page.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Sınaq ünvanı 12"); await page.locator('input[type="checkbox"]').check();
  await page.context().route("https://wa.me/**", route => route.fulfill({ body: "WhatsApp handoff intercepted; no message sent." }));
  const popupPromise = page.waitForEvent("popup"); await page.getByRole("button", { name: "Sifariş ver", exact: true }).click(); const popup = await popupPromise; await expect(page.getByTestId("order-reference")).toBeVisible(); await popup.waitForURL(/https:\/\/wa.me\//);
  const message = new URL(popup.url()).searchParams.get("text")!; expect(message).toContain("Sınaq alıcısı"); expect(message).toContain(multi.name); expect(message).toMatch(/Çatdırılma: 5[.,]00/); expect(message).toContain(await page.getByTestId("order-reference").innerText());
  await popup.close(); await page.goto("/cart"); await expect(page.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible();
});

test("old URLs return 301 directly to the current product and reserve their namespace", async ({ page }) => {
  const second = `${redirectProduct.slug}-qisa`, third = `${redirectProduct.slug}-son`;
  expect((await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).ok()).toBe(true);
  expect(await (await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).json()).toEqual({ slug: null });
  expect((await page.request.get("/api/catalog/redirect?slug=invalid%2Fslug")).status()).toBe(400);
  expect((await admin.request.post("/api/admin/products", { headers: origin, data: update(redirectProduct, second) })).ok()).toBe(true);
  const next = { ...redirectProduct, slug: second }; expect((await admin.request.post("/api/admin/products", { headers: origin, data: update(next, third) })).ok()).toBe(true);
  expect(await (await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).json()).toEqual({ slug: third });
  for (const old of [redirectProduct.slug, second]) { const r = await page.request.get(`/products/${old}?ref=ADIL01&x=1`, { maxRedirects: 0 }); expect(r.status()).toBe(301); expect(new URL(r.headers().location, "http://localhost:3100").toString()).toBe(`http://localhost:3100/products/${third}?ref=ADIL01&x=1`); }
  await page.goto(`/products/${redirectProduct.slug}`); await expect(page).toHaveURL(`http://localhost:3100/products/${third}`); await expect(page.getByRole("heading", { level: 1 })).toHaveText(redirectProduct.name);
  expect((await admin.request.post("/api/admin/product-trash", { headers: origin, data: { action: "delete", ids: [redirectProduct.id] } })).ok()).toBe(true);
  expect(await (await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).json()).toEqual({ slug: null });
  expect((await page.request.get(`/products/${redirectProduct.slug}`, { maxRedirects: 0 })).status()).toBe(404);
});

test("filters, all sort orders, invalid ranges and pagination work together", async ({ page }) => {
  await page.goto(`/products?category=${filterCategory.slug}`); await expect(page.locator('.catalog-page .product-card')).toHaveCount(12);
  const first = await page.locator('.catalog-page .product-title-link').allTextContents(); await page.getByRole("link", { name: "Növbəti", exact: true }).click(); await expect(page).toHaveURL(/page=2/); await expect(page.locator('.catalog-page .product-card')).toHaveCount(2); const second = await page.locator('.catalog-page .product-title-link').allTextContents(); expect(new Set([...first, ...second]).size).toBe(14); await page.getByRole("link", { name: "Əvvəlki", exact: true }).click();
  for (const sort of ["price-asc", "price-desc", "name", "newest"]) { await page.getByLabel("Sıralama", { exact: true }).selectOption(sort); await page.getByRole("button", { name: "Tətbiq et", exact: true }).click(); await expect(page).toHaveURL(new RegExp(`sort=${sort}`)); await expect(page.locator('.catalog-page .product-card')).toHaveCount(12); }
  await page.getByLabel("Minimum qiymət AZN").fill("8"); await page.getByLabel("Maksimum qiymət AZN").fill("10"); await page.getByRole("button", { name: "Tətbiq et", exact: true }).click(); await expect(page.locator('.catalog-page .product-card')).toHaveCount(1); await expect(page.locator('.catalog-page .product-price')).toContainText("9,00");
  await page.getByLabel("Minimum qiymət AZN").fill("20"); await page.getByLabel("Maksimum qiymət AZN").fill("1"); await page.getByRole("button", { name: "Tətbiq et", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Maksimum qiymət"); await page.getByRole("link", { name: "Filtrləri təmizlə", exact: true }).click();
  await page.getByLabel("Axtarış", { exact: true }).fill(`Tapılmayan-${suffix}`); await page.getByRole("button", { name: "Tətbiq et", exact: true }).click(); await expect(page.getByRole("heading", { name: "Məhsul tapılmadı.", exact: true })).toBeVisible();
});

test("short description, price-review flag and business details can be edited; partner code login works", async ({ page }) => {
  await admin.goto("/admin/products"); await admin.getByLabel("Məhsullarda axtar", { exact: true }).fill(single.name); await admin.getByRole("button", { name: `${single.name} redaktə et`, exact: true }).click();
  await admin.getByLabel("Qısa təsvir", { exact: true }).fill("Yenilənmiş qısa Azərbaycan təsviri."); await admin.getByLabel("Qiymət yoxlaması tələb olunur", { exact: true }).check();
  let response = admin.waitForResponse(r => r.url().endsWith("/api/admin/products") && r.request().method() === "POST"); await admin.getByRole("button", { name: "Yadda saxla", exact: true }).click(); expect((await response).ok()).toBe(true); await expect(admin.locator('.price-review-flag')).toBeVisible();
  await page.goto(`/products/${single.slug}`); await expect(page.locator('.detail-short-description')).toHaveText("Yenilənmiş qısa Azərbaycan təsviri.");
  await admin.getByLabel("Qiymət yoxlaması tələb olunur", { exact: true }).uncheck(); response = admin.waitForResponse(r => r.url().endsWith("/api/admin/products") && r.request().method() === "POST"); await admin.getByRole("button", { name: "Yadda saxla", exact: true }).click(); expect((await response).ok()).toBe(true); await expect(admin.locator('.price-review-flag')).toHaveCount(0);
  await admin.goto("/admin/settings"); await admin.getByLabel("Hüquqi şirkət və ya sahibkar adı", { exact: true }).fill("Sınaq şirkəti"); await admin.getByLabel("VÖEN", { exact: true }).fill("1234567890"); await admin.getByLabel("Biznes ünvanı", { exact: true }).fill("Sınaq şəhəri, Sınaq küçəsi 12");
  const saved = admin.waitForResponse(r => r.url().endsWith("/api/admin/settings") && r.request().method() === "POST"); await admin.getByRole("button", { name: "Bütün tənzimləmələri saxla", exact: true }).click(); expect((await saved).ok()).toBe(true);
  await page.goto("/privacy"); await expect(page.locator('.footer-business, #business-info')).toHaveCount(0); await expect(page.locator('.policy-contact')).toContainText("Sınaq şirkəti");
  await page.goto("/"); await page.getByRole("link", { name: "Tərəfdaş girişi", exact: true }).click(); await expect(page).toHaveURL(/\/login$/); await signIn(page, fixture().foreignCode, fixture().password); await expect(page).toHaveURL(/\/partner$/); await expect(page.locator('.dashboard-sidebar')).toBeVisible();
});
