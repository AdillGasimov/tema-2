import { test, expect, type Page, type Locator } from "@playwright/test";
async function expectOptimizedSource(image: Locator, source: string) {
  await expect.poll(async () => { const src = await image.getAttribute("src"); return src ? new URL(src, "http://localhost:3100").searchParams.get("url") : null; }).toBe(source);
}
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const origin = { Origin: "http://localhost:3100" };
const freeDelivery = "28 May (Bakı) üçün çatdırılma ödənişsizdir.";
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
type ProductInput = { id: string; name: string; slug: string; description: string; shortDescription: string; categoryId: string; featured: boolean; variants: { id: string; name: string; sku: string; storeSku: string | null; stockVerified: boolean; costMinor: number; priceMinor: number; stock: number; discountMinor: number | null; commissionMinor: number | null; active: boolean; lowStock: number }[] };
const update = (p: ProductInput, slug = p.slug) => ({ id: p.id, name: p.name, slug, description: p.description, shortDescription: p.shortDescription, categoryId: p.categoryId, status: "PUBLISHED", featured: p.featured,
  variants: p.variants.map(v => ({ id: v.id, name: v.name, sku: v.sku, costMinor: v.costMinor, priceMinor: v.priceMinor, stock: v.stock, stockVerified: v.stockVerified, discountMinor: v.discountMinor, commissionMinor: v.commissionMinor, active: v.active, lowStock: v.lowStock })) });
let admin: Page, initial: { settings: Record<string, unknown>; rule: unknown };
let single: ProductInput, multi: ProductInput, sold: ProductInput, redirectProduct: ProductInput, unverified: ProductInput;
let category: { id: string; slug: string }, filterCategory: { id: string; slug: string };
let secondImage: string;
const suffix = randomUUID().slice(0, 7), filterNames: string[] = [];
const cleanSettings = (s: Record<string, unknown>) => Object.fromEntries(Object.entries(s).filter(([k]) => !["id", "updatedAt"].includes(k)));
test.beforeAll(async ({ browser }) => {
  admin = await browser.newPage(); const f = fixture(); await signIn(admin, f.email, f.password);
  initial = await (await admin.request.get("/api/admin/settings")).json();
  const delivery = JSON.parse(readFileSync("catalog/curation/2026-11-07-content.json", "utf8")).delivery.after;
  expect((await admin.request.post("/api/admin/settings", { headers: origin, data: { settings: { ...cleanSettings(initial.settings), ...delivery, announcement: freeDelivery, deliveryInfo: "", heroImageKey: null, legalName: "", taxId: "", businessAddress: "" }, rule: initial.rule } })).ok()).toBe(true);
  const categories = await (await admin.request.get("/api/admin/categories")).json();
  category = categories.find((c: { name: string }) => c.name === "Ətirləndiricilər");
  if (!category) category = await (await admin.request.post("/api/admin/categories", { headers: origin, data: { name: "Ətirləndiricilər", slug: `audit-etir-${suffix}` } })).json();
  filterCategory = await (await admin.request.post("/api/admin/categories", { headers: origin, data: { name: `Sınaq çeşidi ${suffix}`, slug: `audit-filter-${suffix}` } })).json();
  async function create(label: string, stock: number, prices = [1250], cat = category.id) {
    const response = await admin.request.post("/api/admin/products", { headers: origin, data: { name: `Sınaq məhsulu ${label} ${suffix}`, slug: `audit-${label}-${suffix}`, description: "Azərbaycan dilində ətraflı məhsul məlumatı.", shortDescription: "Azərbaycan dilində qısa məhsul təsviri.", categoryId: cat, status: "PUBLISHED", featured: false,
      variants: prices.map((price, n) => ({ name: n ? "Böyük" : "Standart", sku: `AUD-${suffix}-${label}-${n}`, costMinor: 100, priceMinor: price, stock, stockVerified: true })) } });
    expect(response.ok()).toBe(true); const result = await response.json();
    const all = await (await admin.request.get("/api/admin/products")).json(); return all.products.find((p: { id: string }) => p.id === result.id) as ProductInput;
  }
  single = await create("single", 2); multi = await create("multi", 3, [1000, 2000]); sold = await create("sold", 0); redirectProduct = await create("redirect", 3);
  unverified = await create("unverified", 4, [10000]);
  expect((await admin.request.post("/api/admin/products", { headers: origin, data: { ...update(unverified), variants: update(unverified).variants.map(v => ({ ...v, stockVerified: false })) } })).ok()).toBe(true);
  unverified.variants[0].stockVerified = false;
  for (const [color, product] of [["green", multi], ["blue", multi], ["white", single]] as const) {
    const upload = await admin.request.post("/api/admin/upload", { headers: origin, multipart: { file: { name: "test.png", mimeType: "image/png", buffer: await sharp({ create: { width: 30, height: 30, channels: 3, background: color } }).png().toBuffer() } } });
    expect(upload.ok()).toBe(true); const photo = await upload.json(); if (product.id === multi.id) secondImage = photo.key;
    expect((await admin.request.post("/api/admin/images", { headers: origin, data: { action: "attach", productId: product.id, key: photo.key, alt: `${product.name} şəkli` } })).ok()).toBe(true);
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
    if (path !== "/login") { await expect(page.locator(".announcement > span").first()).toHaveText(freeDelivery); await expect(page.locator(".footer-tag")).toHaveText(freeDelivery); }
    if (path === "/privacy") expect(await page.locator("main").innerText()).not.toContain("Mağaza sahibi fəaliyyətə başlamazdan əvvəl");
    if (path === "/cart") { await expect(page.locator(".cart-storage-note")).toContainText("yalnız bu cihazdakı"); await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/); }
  }
  await page.goto("/"); await expect(page.getByRole("navigation", { name: "Əsas menyu" }).getByRole("link", { name: "Ətirləndiricilər", exact: true })).toHaveCount(1);
  await expect(page.locator("#delivery")).toContainText("3 iş günü"); await expect(page.locator("#delivery")).toContainText("4 iş günü"); await expect(page.locator("#delivery")).toContainText(freeDelivery); await expect(page.locator("#delivery strong")).toHaveText(freeDelivery); await expect(page.locator("#delivery")).toContainText("5,00"); await expect(page.locator("#delivery")).toContainText("WhatsApp");
  await expect(page.locator(".trust-row")).toContainText(freeDelivery);
  await expect(page.locator(".trust-row")).not.toContainText("Şərtlər sifariş zamanı dəqiqləşdirilir");
  await expect(page.locator("#delivery .delivery-extra")).toHaveCount(0);
  await page.locator('.store-footer a[href="/#delivery"]').click(); await expect(page).toHaveURL(/\/#delivery$/); await expect(page.locator("#delivery")).toBeInViewport();
  for (const path of ["/privacy", "/terms", "/returns"]) { const link = page.locator(`.store-footer a[href="${path}"]`); await expect(link).toBeVisible(); expect((await page.request.get(path)).status()).toBe(200); }
  await expect(page.locator(".footer-business, #business-info")).toHaveCount(0);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content"); const response = await page.request.get(image!); expect(response.status()).toBe(200); expect((await sharp(await response.body()).metadata()).width).toBe(1200);
  const robots = await (await page.request.get("/robots.txt")).text(); expect(robots).toContain("Allow: /api/media/"); expect(robots).toContain("Disallow: /cart"); expect(robots).toContain("sitemap.xml");
  const sitemap = await (await page.request.get("/sitemap.xml")).text(); for (const path of ["/terms", "/returns", "/privacy"]) expect(sitemap).toContain(path);
  await page.goto(`/products?category=${category.slug}`); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ətirləndiricilər"); expect(await page.title()).toContain("Ətirləndiricilər"); expect(titles.has(await page.title())).toBe(false);
});

test("product photo arrows, dots, keyboard and image links work without preloading every photo", async ({ page }) => {
  const errors: string[] = [], extraPhotoRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname === "/_next/image" && url.searchParams.get("url") === `/api/media/${secondImage}?public=1` && Number(url.searchParams.get("w")) > 128) extraPhotoRequests.push(url.href);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/products?category=${category.slug}`);
  const card = page.locator(".product-card").filter({ has: page.getByRole("heading", { name: multi.name, exact: true }) });
  await expect(card).toBeVisible(); await expect(card.locator(".product-photo-track img")).toHaveCount(1);
  await page.waitForLoadState("networkidle"); expect(extraPhotoRequests).toHaveLength(0);
  const currentImage = card.locator('.product-photo-slide[aria-hidden="false"] img');
  await expect(card.getByRole("button", { name: "Əvvəlki şəkil", exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Növbəti şəkil", exact: true }).click();
  await expect(card.locator(".photo-count")).toContainText("2 / 2");
  await expectOptimizedSource(currentImage, `/api/media/${secondImage}?public=1`);
  await expect.poll(() => extraPhotoRequests.length).toBeGreaterThan(0);
  await expect(page).toHaveURL(new RegExp(`/products\\?category=${category.slug}$`));
  await expect(card.getByRole("button", { name: "Növbəti şəkil", exact: true })).toBeDisabled();
  await card.getByRole("button", { name: "Şəkil 1", exact: true }).click(); await expect(card.locator(".photo-count")).toContainText("1 / 2");
  const track = card.locator(".product-photo-track"); await track.focus(); await track.press("End");
  await expect(card.locator(".photo-count")).toContainText("2 / 2");
  await track.press("Home"); await expect(card.locator(".photo-count")).toContainText("1 / 2");
  await track.press("ArrowRight"); await expect(card.locator(".photo-count")).toContainText("2 / 2");
  await expect(card.locator("a button")).toHaveCount(0);
  await card.locator('.product-photo-slide[aria-hidden="false"]').click(); await expect(page).toHaveURL(`/products/${multi.slug}`);
  const gallery = page.locator(".product-gallery-detail");
  await gallery.getByRole("button", { name: "Növbəti şəkil", exact: true }).click();
  await expect(gallery.getByRole("button", { name: `${multi.name} şəkil 2`, exact: true })).toHaveAttribute("aria-current", "true");
  await expectOptimizedSource(gallery.locator('.product-photo-slide[aria-hidden="false"] img'), `/api/media/${secondImage}?public=1`);
  await page.goto(`/products/${single.slug}`); await expect(page.locator(".product-gallery-detail .photo-arrow, .product-gallery-detail .photo-count")).toHaveCount(0);
  await page.goto(`/products/${sold.slug}`); await expect(page.locator(".detail-image")).toContainText("Şəkil əlavə ediləcək");
  expect(errors).toEqual([]);
});

test("native mobile photo swipes keep links, vertical page scrolling and gallery thumbnails usable", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage(), session = await context.newCDPSession(page), errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    async function swipe(target: Locator, horizontal: boolean) {
      await target.scrollIntoViewIfNeeded(); const box = (await target.boundingBox())!;
      const start = { x: box.x + box.width * (horizontal ? .8 : .5), y: box.y + box.height * .65 };
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x - (horizontal ? box.width * .6 * step / 8 : 0), y: start.y - (horizontal ? 0 : Math.min(120, box.height * .5) * step / 8) }] });
        await page.waitForTimeout(20);
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await page.goto(`/products?category=${category.slug}`);
    const card = page.locator(".product-card").filter({ has: page.getByRole("heading", { name: multi.name, exact: true }) });
    await card.scrollIntoViewIfNeeded(); const previous = (await card.getByRole("button", { name: "Əvvəlki şəkil", exact: true }).boundingBox())!;
    await page.touchscreen.tap(previous.x + previous.width / 2, previous.y + previous.height / 2);
    await expect(page).toHaveURL(new RegExp(`/products\\?category=${category.slug}$`)); await expect(card.locator(".photo-count")).toContainText("1 / 2");
    await swipe(card.locator(".product-photo-track"), true); await expect(card.locator(".photo-count")).toContainText("2 / 2");
    await expect(page).toHaveURL(new RegExp(`/products\\?category=${category.slug}$`));
    await card.scrollIntoViewIfNeeded(); const before = await page.evaluate(() => scrollY);
    await swipe(card.locator(".product-photo-track"), false); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await expect(card.locator(".photo-count")).toContainText("2 / 2");
    await card.locator('.product-photo-slide[aria-hidden="false"]').tap(); await expect(page).toHaveURL(`/products/${multi.slug}`);
    const gallery = page.locator(".product-gallery-detail"); await swipe(gallery.locator(".product-photo-track"), true);
    await expect(gallery.locator(".photo-count")).toContainText("2 / 2");
    await expectOptimizedSource(gallery.locator('.product-photo-slide[aria-hidden="false"] img'), `/api/media/${secondImage}?public=1`);
    await expect(gallery.getByRole("button", { name: `${multi.name} şəkil 2`, exact: true })).toHaveAttribute("aria-current", "true");
    await gallery.getByRole("button", { name: `${multi.name} şəkil 1`, exact: true }).tap(); await expect(gallery.locator(".photo-count")).toContainText("1 / 2");
    await gallery.getByRole("button", { name: "Növbəti şəkil", exact: true }).tap(); await expect(gallery.locator(".photo-count")).toContainText("2 / 2");
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => gallery.locator(".product-photo-track").evaluate(element => element.scrollLeft / element.clientWidth)).toBeCloseTo(1, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("product options, stock limits, gallery, device cart, buy-now and WhatsApp checkout work", async ({ page, browser }) => {
  await page.goto(`/products/${sold.slug}`); await expect(page.locator('.purchase select')).toHaveCount(0); await expect(page.locator('.purchase .out-stock')).toContainText("Stokda yoxdur");
  await expect(page.getByRole("button", { name: "Artır", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Səbətə əlavə et", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "İndi sifariş et", exact: true })).toBeDisabled();
  await page.goto(`/products/${single.slug}`); await expect(page.locator('.purchase select')).toHaveCount(0); await expect(page.locator('.detail-short-description')).toHaveText(single.shortDescription);
  await expect(page.locator(".purchase .in-stock")).toContainText("Stokda"); await expect(page.locator(".purchase .free-delivery-note")).toHaveText(freeDelivery);
  await expect(page.getByRole("button", { name: "Azalt", exact: true })).toBeDisabled(); await page.getByRole("button", { name: "Artır", exact: true }).click(); await expect(page.getByRole("button", { name: "Artır", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Azalt", exact: true }).click(); await page.getByRole("button", { name: "Səbətə əlavə et", exact: true }).click(); await page.getByRole("button", { name: "Səbətə əlavə edildi", exact: true }).click(); await expect(page.getByRole("button", { name: "Səbətə əlavə edildi", exact: true })).toBeDisabled();
  await page.reload(); await page.goto("/cart"); await expect(page.locator(".summary-card .free-delivery-note")).toHaveText(freeDelivery); await expect(page.locator(".cart-storage-note")).toBeVisible(); await expect(page.getByRole("button", { name: `${single.name} artır`, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: `${single.name} azalt`, exact: true }).click(); await page.getByRole("button", { name: `${single.name} artır`, exact: true }).click();
  const otherDevice = await browser.newContext(); try { const empty = await otherDevice.newPage(); await empty.goto("http://localhost:3100/cart"); await expect(empty.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible(); } finally { await otherDevice.close(); }
  await page.getByLabel("Referal kodu (istəyə bağlı)", { exact: true }).fill(fixture().foreignCode); await page.getByRole("button", { name: "Kodu tətbiq et" }).click(); await expect(page.locator('.summary-card [role="status"]')).toContainText(fixture().foreignCode);
  await page.getByRole("button", { name: `${single.name} sil`, exact: true }).click(); await expect(page.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible();
  await page.goto(`/products/${multi.slug}`); await expect(page.getByLabel("Variant", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Artır", exact: true }).click(); await page.getByLabel("Variant", { exact: true }).selectOption(multi.variants[1].id); await expect(page.locator('.purchase .quantity-control > span')).toHaveText("1"); await expect(page.locator('.detail-price')).toContainText("20,00");
  await page.getByRole("button", { name: `${multi.name} şəkil 2`, exact: true }).click(); await expectOptimizedSource(page.locator('.detail-image .product-photo-slide[aria-hidden="false"] img'), `/api/media/${secondImage}?public=1`);
  await page.getByRole("button", { name: "İndi sifariş et", exact: true }).click(); await expect(page).toHaveURL(/\/checkout$/); await expect(page.locator(".summary-card .free-delivery-note")).toHaveText(freeDelivery); await expect(page.locator('.cart-storage-note')).toBeVisible();
  await expect(page.getByLabel("Şəhər və ya bölgə", { exact: true })).toHaveValue("28 May (Bakı)"); await expect(page.locator('.summary-line').filter({ hasText: "Çatdırılma" })).toContainText("0,00");
  await page.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("Bakı"); await expect(page.locator('.summary-line').filter({ hasText: "Çatdırılma" })).toContainText("5,00");
  await page.getByLabel("Ad və soyad", { exact: true }).fill("Sınaq alıcısı"); await page.getByLabel("Telefon nömrəsi", { exact: true }).fill("+994500005566"); await page.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Sınaq ünvanı 12"); await page.locator('input[type="checkbox"]').check();
  await page.getByLabel("Əlavə qeyd (istəyə bağlı)", { exact: true }).fill("Gəlməzdən əvvəl zəng edin.\nQapı № 12 🔔");
  await page.context().route(/^https:\/\/(wa\.me|web\.whatsapp\.com)\//, route => route.fulfill({ body: "WhatsApp handoff intercepted; no message sent." }));
  let orderPosts = 0; page.on("request", request => { if (request.url().endsWith("/api/orders") && request.method() === "POST") orderPosts++; });
  const popupPromise = page.waitForEvent("popup"); await page.getByRole("button", { name: "Sifariş ver", exact: true }).click(); const popup = await popupPromise; await expect(page.getByTestId("order-reference")).toBeVisible(); await popup.waitForURL(/https:\/\/web\.whatsapp\.com\/send/);
  const message = new URL(popup.url()).searchParams.get("text")!; expect(message).toContain("Sınaq alıcısı"); expect(message).toContain(multi.name); expect(message).toMatch(/Çatdırılma: 5[.,]00/); expect(message).toContain(await page.getByTestId("order-reference").innerText());
  expect(message).toContain(`*${initial.settings.brandName}* mağazasından`); expect(message).toContain("Salam! 👋\n"); expect(message).toContain("\n\n🛍️ *Məhsullar*\n1. *");
  expect(message).toContain("Variant: Böyük"); expect(message).toContain("1 ədəd × 20,00\u00a0₼ = *20,00\u00a0₼*"); expect(message).toContain("*Yekun məbləğ: 25,00\u00a0₼*");
  expect(message).toContain("👤 *Müştəri məlumatları*"); expect(message).toContain("📍 *Çatdırılma ünvanı*\nBakı\nSınaq ünvanı 12"); expect(message).toContain("✅");
  expect(message).toContain("📝 *Qeyd*\nGəlməzdən əvvəl zəng edin.\nQapı № 12 🔔"); expect(message).toContain(`🎟️ *Referal kodu:* ${fixture().foreignCode}`);
  expect(message).not.toContain("\ufffd");
  await expect(page.getByRole("link", { name: "WhatsApp Web-də aç", exact: true })).toHaveAttribute("href", popup.url());
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { sessionStorage.setItem("copied-whatsapp", text); } } }));
  await page.getByRole("button", { name: "Mesajı kopyala", exact: true }).click(); await expect(page.locator('.success-card [role="status"]')).toContainText("Mesaj emojilərlə birlikdə kopyalandı.");
  expect(await page.evaluate(() => sessionStorage.getItem("copied-whatsapp"))).toBe(message);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); } } }));
  await page.getByRole("button", { name: "Mesajı kopyala", exact: true }).click(); await expect(page.locator('.success-card [role="alert"]')).toContainText("Avtomatik kopyalama alınmadı.");
  await expect(page.getByLabel("Sifariş mesajı", { exact: true })).toBeVisible(); await expect(page.getByLabel("Sifariş mesajı", { exact: true })).toHaveValue(message);
  expect(orderPosts).toBe(1);
  await popup.close(); await page.goto("/cart"); await expect(page.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible();
});

test("mobile WhatsApp link preserves emoji when the automatic popup is blocked", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Linux; Android 14) Chrome/138 Mobile" });
    window.open = () => null;
  });
  await page.goto(`/products/${single.slug}`); await page.getByRole("button", { name: "İndi sifariş et", exact: true }).click(); await expect(page).toHaveURL(/\/checkout$/);
  await page.getByLabel("Ad və soyad", { exact: true }).fill("Mobil sınaq alıcısı"); await page.getByLabel("Telefon nömrəsi", { exact: true }).fill("501234567");
  await page.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Sınaq ünvanı 12"); await page.locator('input[name="consent"]').check();
  const submitted = page.waitForResponse(r => r.url().endsWith("/api/orders") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Sifariş ver", exact: true }).click(); const response = await submitted; expect(response.ok()).toBe(true); const order = await response.json();
  await expect(page.getByTestId("order-reference")).toHaveText(order.reference);
  await expect(page.getByRole("link", { name: "WhatsApp-da aç", exact: true })).toHaveAttribute("href", order.whatsappUrl);
  expect(new URL(order.whatsappUrl).hostname).toBe("wa.me"); expect(new URL(order.whatsappUrl).searchParams.get("text")).toBe(order.whatsappMessage);
  expect(order.whatsappMessage).toContain("Salam! 👋"); expect(order.whatsappMessage).toContain("✅"); expect(order.whatsappMessage).not.toContain("\ufffd");
  await expect(page.getByRole("button", { name: "Mesajı kopyala", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("checkout contact errors block invalid submissions, normalize phone entry and display server failures", async ({ page }) => {
  let attempts = 0; const popups: Page[] = [];
  page.on("request", request => { if (request.url().endsWith("/api/orders") && request.method() === "POST") attempts++; });
  page.on("popup", popup => popups.push(popup));
  await page.goto(`/products/${single.slug}`); await page.getByRole("button", { name: "İndi sifariş et", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const phone = page.getByLabel("Telefon nömrəsi", { exact: true });
  await page.getByRole("button", { name: "Sifariş ver", exact: true }).click();
  for (const name of ["name", "phone", "address", "consent"]) await expect(page.locator(`#checkout-${name}-error`)).toBeVisible();
  await expect(page.getByLabel("Ad və soyad", { exact: true })).toBeFocused(); expect(attempts).toBe(0); expect(popups).toHaveLength(0);
  await page.getByLabel("Ad və soyad", { exact: true }).fill("Sınaq alıcısı");
  await phone.fill("50abc#123"); await expect(phone).toHaveValue(""); await expect(page.locator("#checkout-phone-error")).toContainText("rəqəm");
  await phone.pressSequentially("50ab#@12"); await expect(phone).toHaveValue("5012");
  await phone.fill("50123"); await page.getByLabel("Çatdırılma ünvanı", { exact: true }).click();
  await expect(phone).toHaveAttribute("aria-invalid", "true"); await expect(page.locator("#checkout-phone-error")).toContainText("9 rəqəm");
  await phone.evaluate(input => {
    const data = new DataTransfer(); data.setData("text/plain", "+994 (50) 123-45-67");
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(phone).toHaveValue("501234567"); await expect(phone).toHaveAttribute("aria-invalid", "false");
  await page.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Sınaq ünvanı 12");
  await page.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Sifariş ver", exact: true }).click();
  await expect(page.locator("#checkout-city-error")).toBeVisible(); await expect(page.locator("#checkout-consent-error")).toBeVisible();
  expect(attempts).toBe(0); expect(popups).toHaveLength(0);
  await page.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("28 May (Bakı)");
  await page.locator('input[name="consent"]').check();
  const rejected = await page.request.post("/api/orders", { headers: origin, data: { idempotencyKey: randomUUID(), name: "Sınaq alıcısı", phone: "+99450abc4567", city: "28 May (Bakı)", address: "Sınaq ünvanı 12", items: [{ variantId: single.variants[0].id, quantity: 1 }] } });
  expect(rejected.status()).toBe(400); expect((await rejected.json()).fields.fieldErrors.phone[0]).toContain("9 rəqəm");
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === "checkout-attempt") throw new DOMException("Blocked", "SecurityError"); setItem.call(this, key, value); };
  });
  let failures = 0; const retryKeys: string[] = [];
  await page.route("**/api/orders", route => {
    failures++;
    expect(route.request().postDataJSON().phone).toBe(failures === 1 ? "+994501234567" : "+994501234568");
    retryKeys.push(route.request().postDataJSON().idempotencyKey);
    return failures === 1 ? route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Məlumatları yoxlayın.", fields: { fieldErrors: { phone: ["Telefon nömrəsini yenidən yoxlayın."] } } }) }) : route.fulfill({ status: 502, contentType: "text/plain", body: "Upstream unavailable" });
  });
  await page.getByRole("button", { name: "Sifariş ver", exact: true }).click();
  await expect(page.locator("#checkout-phone-error")).toHaveText("Telefon nömrəsini yenidən yoxlayın.");
  await expect.poll(() => popups.length).toBe(1); await expect.poll(() => popups[0].isClosed()).toBe(true);
  await phone.fill("501234568"); await page.getByRole("button", { name: "Sifariş ver", exact: true }).click();
  await expect(page.locator('.summary-card .error-message[role="alert"]')).toHaveText("Sifariş alınmadı. Yenidən cəhd edin.");
  await expect.poll(() => popups.length).toBe(2); await expect.poll(() => popups[1].isClosed()).toBe(true);
  await expect(page.getByRole("button", { name: "Sifariş ver", exact: true })).toBeEnabled(); expect(attempts).toBe(2);
  await page.getByRole("button", { name: "Sifariş ver", exact: true }).click();
  await expect.poll(() => attempts).toBe(3); await expect.poll(() => popups.length).toBe(3); await expect.poll(() => popups[2].isClosed()).toBe(true);
  expect(retryKeys[1]).toBe(retryKeys[2]);
});

test("old URLs return 301 directly to the current product and reserve their namespace", async ({ page }) => {
  const second = `${redirectProduct.slug}-qisa`, third = `${redirectProduct.slug}-son`;
  expect((await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).ok()).toBe(true);
  expect(await (await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).json()).toEqual({ slug: null });
  expect((await page.request.get("/api/catalog/redirect?slug=invalid%2Fslug")).status()).toBe(400);
  expect((await admin.request.post("/api/admin/products", { headers: origin, data: update(redirectProduct, second) })).ok()).toBe(true);
  const next = { ...redirectProduct, slug: second }; expect((await admin.request.post("/api/admin/products", { headers: origin, data: update(next, third) })).ok()).toBe(true);
  expect(await (await page.request.get(`/api/catalog/redirect?slug=${redirectProduct.slug}`)).json()).toEqual({ slug: third });
  for (const old of [redirectProduct.slug, second]) { const r = await page.request.get(`/products/${old}?ref=ADIL01&x=1`, { maxRedirects: 0 }); expect(r.status()).toBe(301); expect(r.headers()["server-timing"]).toContain('desc="direct"'); expect(new URL(r.headers().location, "http://localhost:3100").toString()).toBe(`http://localhost:3100/products/${third}?ref=ADIL01&x=1`); }
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
  await page.getByLabel("Minimum qiymət AZN").fill("20"); await page.getByLabel("Maksimum qiymət AZN").fill("1"); await page.getByRole("button", { name: "Tətbiq et", exact: true }).click(); await expect(page.locator('.catalog-page [role="alert"]')).toContainText("Maksimum qiymət"); await page.getByRole("link", { name: "Filtrləri təmizlə", exact: true }).click();
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

test("owned SKUs, recorded stock, refreshed cart prices and direct publication work", async ({ page }) => {
  await page.goto(`/products/${unverified.slug}`);
  await expect(page.locator('.purchase .in-stock')).toContainText("Stokda");
  await expect(page.locator('.purchase .in-stock')).toContainText(unverified.variants[0].storeSku!);
  await expect(page.locator('.stock-check')).toHaveCount(0);
  expect(await page.locator('.purchase').innerText()).not.toContain(unverified.variants[0].sku);
  const jsonld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(jsonld.offers[0].sku).toMatch(/^FC-\d{4,}$/); expect(jsonld.offers[0].availability).toBe("https://schema.org/InStock");
  const publicCatalog = await (await page.request.get(`/api/catalog?q=${encodeURIComponent(unverified.name)}`)).json();
  expect(publicCatalog.products[0].variants[0]).not.toHaveProperty("sku");
  await page.getByRole("button", { name: "Səbətə əlavə et", exact: true }).click();
  await expect(page.getByRole("button", { name: "Səbətə əlavə edildi", exact: true })).toBeVisible();
  const changed = { ...update(unverified), variants: update(unverified).variants.map(v => ({ ...v, priceMinor: 1999 })) };
  expect((await admin.request.post("/api/admin/products", { headers: origin, data: changed })).ok()).toBe(true);
  await page.goto("/cart"); await expect(page.locator('.cart-item strong').first()).toContainText("19,99");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("store-cart-v1")!)[0].priceMinor)).toBe(1999);
  expect((await admin.request.post("/api/admin/inventory", { headers: origin, data: { variantId: unverified.variants[0].id, delta: 0, stockVerified: true, reason: "Test mühitində fiziki stok təsdiqi" } })).ok()).toBe(true);
  await page.goto(`/products/${unverified.slug}`); await expect(page.locator('.purchase .in-stock')).toContainText("Stokda");
  expect((await admin.request.post("/api/admin/products", { headers: origin, data: { ...changed, status: "DRAFT", rightsReviewRequired: true } })).ok()).toBe(true);
  expect((await page.request.get(`/products/${unverified.slug}`)).status()).toBe(404);
  await page.goto("/cart"); await expect(page.getByRole("heading", { name: "Səbətiniz hələ boşdur.", exact: true })).toBeVisible();
  await admin.goto("/admin/products");
  await admin.getByRole("button", { name: `${unverified.name} redaktə et`, exact: true }).click();
  await expect(admin.locator('input[name="rightsReviewRequired"], textarea[name="rightsClearance"]')).toHaveCount(0);
  await admin.locator('select[name="status"]').selectOption("PUBLISHED");
  const published = admin.waitForResponse(r => r.url().endsWith("/api/admin/products") && r.request().method() === "POST");
  await admin.getByRole("button", { name: "Yadda saxla", exact: true }).click(); expect((await published).ok()).toBe(true);
  expect((await admin.request.post("/api/admin/product-bulk", { headers: origin, data: { ids: [unverified.id], status: "DRAFT" } })).ok()).toBe(true);
  expect((await admin.request.post("/api/admin/product-bulk", { headers: origin, data: { ids: [unverified.id], status: "PUBLISHED" } })).ok()).toBe(true);
  expect((await page.request.get(`/products/${unverified.slug}`)).status()).toBe(200);
  await page.goto("/returns"); await expect(page.locator("main")).toContainText("3 təqvim günü"); await expect(page.locator("main")).toContainText("alış günü sayılmadan 14 gün"); await expect(page.locator("main")).toContainText("7 iş günü");
});
