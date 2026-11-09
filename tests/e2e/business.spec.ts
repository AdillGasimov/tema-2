import { test, expect, type Page, type Locator } from "@playwright/test";
async function expectOptimizedSource(image: Locator, source: string) {
  await expect.poll(async () => { const src = await image.getAttribute("src"); return src ? new URL(src, "http://localhost:3100").searchParams.get("url") : null; }).toBe(source);
}
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import sharp from "sharp";
import { csv } from "../../src/lib/csv";
import { fullCsv, normalizeProduct, updateProduct } from "../../extensions/birmarket-product-exporter/core.js";
type Fixture = { run: string; email: string; password: string; otherId: string; otherEmail: string; foreignId: string; foreignCode: string };
const fixture = (): Fixture => JSON.parse(readFileSync(".local/e2e.json", "utf8"));
async function login(page: Page, email: string, password: string) {
  await page.goto("/login"); await page.getByLabel("E-poçt və ya referal kodu", { exact: true }).fill(email); await page.getByLabel("Parol", { exact: true }).fill(password);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(r => r.url().includes("/api/auth/sign-in/email") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Daxil ol", exact: true }).click();
    const result = await response;
    if (result.status() === 429) { await new Promise(resolve => setTimeout(resolve, Math.min(60, Number(result.headers()["retry-after"]) || 11) * 1000)); continue; }
    expect(result.ok()).toBeTruthy(); await page.waitForURL(/\/(admin|partner)/, { timeout: 15000 }); return;
  }
  throw new Error("Login rate limit did not clear after its advertised retry window.");
}
test("complete UI workflow: product + image + partner → referral checkout → completion → commission → payout", async ({ page, browser }) => {
  const f = fixture(); const name = `E2E mikrofiber ${f.run}`, code = `WASH${f.run.toUpperCase()}`; const partnerEmail = `partner-${f.run}@example.test`;
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await login(page, f.email, f.password);
  await page.goto("/admin/products"); await page.getByRole("button", { name: "Yeni məhsul", exact: true }).click();
  await page.getByLabel("Məhsulun adı", { exact: true }).fill(name); await page.getByLabel("URL adı (slug)").fill(`e2e-${f.run}`);
  await page.locator('select[name="categoryId"]').selectOption({ index: 1 }); await page.locator('select[name="status"]').selectOption("DRAFT");
  await page.getByLabel("Məhsul təsviri").fill("E2E yoxlama məhsulu, yalnız təcrid edilmiş test bazasında.");
  await page.getByLabel("CSV / daxili kod", { exact: true }).fill(`E2E-${f.run}`); await page.getByLabel("Stok sayı", { exact: true }).fill("10");
  await page.getByLabel("Alış maya dəyəri (AZN)", { exact: true }).fill("5.00"); await page.getByLabel("Satış qiyməti (AZN)", { exact: true }).fill("15.00");
  await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
  await expect(page.getByLabel("Məhsul şəkilləri", { exact: true })).toBeVisible();
  const photo = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#a9c182" } }).png().toBuffer();
  await page.getByLabel("Məhsul şəkilləri", { exact: true }).setInputFiles({ name: "test-towel.png", mimeType: "image/png", buffer: photo });
  await expect(page.locator(".admin-image-grid img")).toBeVisible({ timeout: 15000 });
  const photoPath = await page.locator(".admin-image-grid img").first().getAttribute("src");
  expect(photoPath).toBeTruthy(); const photoUrl = new URL(photoPath!, page.url()).toString();
  const privateVisitor = await browser.newContext();
  expect((await privateVisitor.request.get(photoUrl)).status()).toBe(401);
  const ownerPhoto = await page.request.get(photoUrl); expect(ownerPhoto.status()).toBe(200);
  expect(ownerPhoto.headers()["cache-control"]).toBe("private, no-store");
  const publicSource = `${photoPath}?public=1`;
  const optimizedPath = `/_next/image?${new URLSearchParams({ url: publicSource, w: "96", q: "75" })}`;
  // Signed-in preview access must not create a publicly cached draft rendition.
  expect((await page.request.get(publicSource)).status()).toBe(404);
  const privateOptimized = await page.request.get(optimizedPath);
  expect(privateOptimized.status()).toBeGreaterThanOrEqual(400);
  expect(privateOptimized.headers()["content-type"] ?? "").not.toMatch(/^image\//);
  const secondPhoto = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#dce8cf" } }).png().toBuffer();
  await page.getByLabel("Məhsul şəkilləri", { exact: true }).setInputFiles({ name: "second-cover.png", mimeType: "image/png", buffer: secondPhoto });
  await expect(page.locator(".admin-image-grid img")).toHaveCount(2);
  const secondPhotoPath = await page.locator(".admin-image-grid img").nth(1).getAttribute("src");
  const coverChanged = page.waitForResponse(r => r.url().endsWith("/api/admin/images") && r.request().postDataJSON()?.action === "cover");
  await page.getByRole("button", { name: "Əsas şəkil et", exact: true }).click(); expect((await coverChanged).ok()).toBeTruthy();
  await expect(page.locator(".admin-image-grid img").first()).toHaveAttribute("src", secondPhotoPath!);
  await expect(page.getByText("Əsas şəkil", { exact: true })).toBeVisible();
  await page.locator('select[name="status"]').selectOption("PUBLISHED");
  const published = page.waitForResponse(r => r.url().endsWith("/api/admin/products") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Yadda saxla", exact: true }).click(); expect((await published).ok()).toBeTruthy();
  expect((await privateVisitor.request.get(photoUrl)).status()).toBe(200); await privateVisitor.close();
  const resized = await page.request.get(optimizedPath); expect(resized.status()).toBe(200);
  expect((await sharp(await resized.body()).metadata()).width).toBe(96);
  await page.goto("/admin/partners"); await page.getByRole("button", { name: "Yeni tərəfdaş", exact: true }).click();
  await page.getByLabel("Ad və soyad", { exact: true }).fill("E2E Tərəfdaş"); await page.getByLabel("Telefon", { exact: true }).fill("+994500004444");
  await page.getByLabel("E-poçt (istəyə bağlı)", { exact: true }).fill(partnerEmail); await page.getByLabel("İlk giriş parolu", { exact: true }).fill(f.password);
  await page.getByLabel("Referal kodu", { exact: true }).fill(code); await page.getByLabel("Sahə", { exact: true }).fill("Avtoyuma");
  await page.getByRole("button", { name: "Yadda saxla", exact: true }).click(); await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
  const partnersResponse = await page.request.get("/api/admin/partners"); const partners = await partnersResponse.json(); const partner = partners.find((p: { code: string }) => p.code === code);
  expect(partner).toBeTruthy();
  const pngResponse = await page.request.get(`/api/cards?ids=${partner.id}&format=png`); expect(pngResponse.ok()).toBeTruthy();
  const png = PNG.sync.read(await pngResponse.body()); const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height); expect(decoded?.data).toBe(`http://localhost:3100/?ref=${code}`);
  const pdf = await page.request.get(`/api/cards?ids=${partner.id}&format=pdf`); expect(pdf.headers()["content-type"]).toBe("application/pdf"); expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const customer = await browser.newContext({ viewport: { width: 390, height: 844 } }); const shop = await customer.newPage();
  const refResponse = shop.waitForResponse(r => r.url().endsWith("/api/referrals") && r.request().method() === "POST");
  await shop.goto(`/?ref=${code}`); expect((await refResponse).ok()).toBeTruthy();
  const referralCookie = (await customer.cookies()).find(c => c.name === "store-referral");
  expect(referralCookie?.httpOnly).toBe(true); expect(referralCookie?.sameSite).toBe("Lax");
  expect(await (await shop.request.get("/api/referrals")).json()).toEqual({ code });
  await expect(shop.locator('.error-message[role="alert"]')).toHaveCount(0);
  const repeatReferral = shop.waitForResponse(r => r.url().endsWith("/api/referrals") && r.request().method() === "POST");
  await shop.reload(); expect((await repeatReferral).ok()).toBeTruthy();
  const visitedPartners = await (await page.request.get("/api/admin/partners")).json();
  expect(visitedPartners.find((p: { code: string }) => p.code === code)._count.visits).toBe(1);
  await shop.goto(`/products/e2e-${f.run}`); await expect(shop.getByRole("heading", { name, exact: true })).toBeVisible();
  await shop.getByRole("button", { name: "Səbətə əlavə et", exact: true }).click(); await shop.goto("/checkout");
  await expect(shop.getByLabel("Referal kodu (istəyə bağlı)", { exact: true })).toHaveValue(code);
  await shop.getByLabel("Ad və soyad", { exact: true }).fill("E2E Müştəri"); await shop.getByLabel("Telefon nömrəsi", { exact: true }).fill("+994500005555");
  await shop.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("Bakı"); await shop.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Test küçəsi 10, mənzil 2");
  await shop.locator('input[type="checkbox"]').check();
  await customer.route(/^https:\/\/(wa\.me|web\.whatsapp\.com)\//, route => route.fulfill({ body: "WhatsApp handoff intercepted by test." }));
  const popupPromise = shop.waitForEvent("popup"); await shop.getByRole("button", { name: "Sifariş ver", exact: true }).click(); const popup = await popupPromise;
  await expect(shop.getByTestId("order-reference")).toBeVisible(); const reference = await shop.getByTestId("order-reference").innerText();
  await popup.waitForURL(/https:\/\/web\.whatsapp\.com\/send/); expect(decodeURIComponent(popup.url())).toContain(reference); expect(decodeURIComponent(popup.url())).toContain(code);
  const adminOrders = await (await page.request.get("/api/admin/orders")).json(); const order = adminOrders.find((o: { reference: string }) => o.reference === reference); expect(order.status).toBe("WHATSAPP_PENDING"); expect(order.paymentStatus).toBe("UNPAID");
  await page.goto("/admin/orders");
  const orderRow = page.getByRole("row").filter({ hasText: reference });
  const confirmed = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().method() === "POST");
  await orderRow.getByRole("button", { name: `${reference} Təsdiqlə`, exact: true }).click(); expect((await confirmed).ok()).toBeTruthy();
  await expect(orderRow.getByText("Təsdiqlənib", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `${reference} bax`, exact: true }).click();
  await page.getByLabel("Əməliyyat məbləği (AZN)", { exact: true }).fill("15.00"); await page.getByLabel("Üsul", { exact: true }).fill("Nağd"); await page.getByLabel("Tranzaksiya / əməliyyat istinadı", { exact: true }).fill(`CASH-${f.run}`);
  const paid = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().method() === "POST"); await page.getByRole("button", { name: "Maliyyə əməliyyatını qeydə al", exact: true }).click(); expect((await paid).ok()).toBeTruthy();
  const delivered = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().postDataJSON()?.action === "deliver");
  await orderRow.getByRole("button", { name: `${reference} Çatdırıldı`, exact: true }).click(); expect((await delivered).ok()).toBeTruthy();
  await expect(orderRow.getByText("Tamamlanıb", { exact: true })).toBeVisible();
  await page.goto("/admin/commissions"); const row = page.getByRole("row").filter({ hasText: reference }); await row.getByRole("button", { name: "Təsdiqlə", exact: true }).click(); await row.getByRole("button", { name: "Ödənişə hazır et", exact: true }).click(); await expect(row.getByText("Ödənişə hazır", { exact: true })).toBeVisible();
  const partnerContext = await browser.newContext(); const portal = await partnerContext.newPage(); await login(portal, partnerEmail, f.password); await expect(portal.getByText(reference, { exact: true }).first()).toBeVisible();
  const privateData = await (await portal.request.get("/api/partner")).text(); expect(privateData).not.toContain("+994500005555"); expect(privateData).not.toContain("Test küçəsi"); expect(privateData).not.toContain("unitCostMinor");
  await page.goto("/admin/payouts"); await page.getByLabel("Tərəfdaş", { exact: true }).selectOption(partner.id); await page.getByLabel(`${reference} —`).check();
  await page.getByLabel("Ödəniş üsulu", { exact: true }).fill("Bank"); await page.getByLabel("Bank / ödəniş istinadı", { exact: true }).fill(`BANK-${f.run}`);
  await page.getByRole("button", { name: "Edilmiş ödənişi qeydə al", exact: true }).click(); await expect(page.getByRole("cell", { name: `BANK-${f.run}`, exact: true })).toBeVisible();
  await portal.reload(); await expect(portal.getByRole("cell", { name: `BANK-${f.run}`, exact: true })).toBeVisible();
  const summary = await (await page.request.get("/api/admin/analytics")).json(); expect(summary.revenue).toBeGreaterThanOrEqual(1500); expect(summary.cogs).toBeGreaterThanOrEqual(500);
  const item = summary.products.find((p: { name: string }) => p.name === name); expect(item.revenue).toBe(1500); expect(item.cost).toBe(500);
  await shop.screenshot({ path: "test-results/mobile-checkout.png", fullPage: true });
  writeFileSync(".local/e2e-order.json", JSON.stringify({ partnerId: partner.id, reference }));
  expect(errors).toEqual([]); await customer.close(); await partnerContext.close();
});
test("authorization, ownership, CSRF and private data boundaries", async ({ page, browser }) => {
  const f = fixture(); const unauth = await page.request.get("/api/admin/orders"); expect(unauth.status()).toBe(401);
  const payout = await page.request.post("/api/admin/payouts", { headers: { Origin: "http://localhost:3100" }, data: {} }); expect(payout.status()).toBe(401);
  expect((await page.request.post("/api/admin/orders", { headers: { Origin: "http://localhost:3100" }, data: { action: "deliver", orderId: "missing" } })).status()).toBe(401);
  expect((await page.request.post("/api/admin/images", { headers: { Origin: "http://localhost:3100" }, data: { action: "cover", productId: "missing", key: "missing" } })).status()).toBe(401);
  await login(page, f.otherEmail, f.password);
  expect((await page.request.get("/api/admin/products")).status()).toBe(403);
  expect((await page.request.post("/api/admin/commissions", { headers: { Origin: "http://localhost:3100" }, data: {} })).status()).toBe(403);
  expect((await page.request.post("/api/admin/orders", { headers: { Origin: "http://localhost:3100" }, data: { action: "deliver", orderId: "missing" } })).status()).toBe(403);
  expect((await page.request.post("/api/admin/images", { headers: { Origin: "http://localhost:3100" }, data: { action: "cover", productId: "missing", key: "missing" } })).status()).toBe(403);
  const p = await (await page.request.get("/api/partner?partnerId=someone-else")).json(); expect(p.partner.id).toBe(f.otherId); expect(p.orders).toHaveLength(0);
  expect((await page.request.get(`/api/cards?ids=${f.foreignId}&format=png`)).status()).toBe(403);
  const adminContext = await browser.newContext(); const admin = await adminContext.newPage(); await login(admin, f.email, f.password);
  expect((await admin.request.post("/api/admin/expenses", { headers: { Origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  expect((await admin.request.post("/api/admin/products", { headers: { Origin: "http://localhost:3100" }, data: { name: "invalid" } })).status()).toBe(400);
  expect((await admin.request.post("/api/admin/orders", { headers: { Origin: "https://outside.example" }, data: { action: "deliver", orderId: "missing" } })).status()).toBe(403);
  expect((await admin.request.post("/api/admin/orders", { headers: { Origin: "http://localhost:3100" }, data: { action: "deliver", orderId: "missing", paidMinor: 1500 } })).status()).toBe(400);
  expect((await admin.request.post("/api/admin/images", { headers: { Origin: "https://outside.example" }, data: { action: "cover", productId: "missing", key: "missing" } })).status()).toBe(403);
  expect((await admin.request.post("/api/admin/images", { headers: { Origin: "http://localhost:3100" }, data: { action: "cover", productId: "missing", key: "missing", priceMinor: 1 } })).status()).toBe(400);
  expect((await admin.request.get("/api/admin/export?type=orders")).headers()["content-type"]).toContain("text/csv");
  await adminContext.close();
  const codeContext = await browser.newContext(); const codePage = await codeContext.newPage(); await login(codePage, f.foreignCode, f.password); expect((await (await codePage.request.get("/api/partner")).json()).partner.id).toBe(f.foreignId); await codeContext.close();
});
test("all management pages render; rebranding and product changes apply without a rebuild", async ({ page, browser }) => {
  const f = fixture(); await login(page, f.email, f.password); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const section of ["overview", "products", "categories", "inventory", "orders", "customers", "partners", "cards", "commissions", "payouts", "analytics", "expenses", "reports", "disputes", "notifications", "integrations", "audit", "settings"]) {
    const response = await page.goto(`/admin/${section}`); expect(response?.status()).toBe(200); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const initial = await (await page.request.get("/api/admin/settings")).json();
  const settings = Object.fromEntries(Object.entries(initial.settings).filter(([key]) => !["id", "updatedAt"].includes(key)));
  const products = await (await page.request.get("/api/admin/products")).json(); const product = products.products.find((p: { slug: string }) => p.slug === `e2e-${f.run}`);
  const headers = { Origin: "http://localhost:3100" };
  try {
    await page.getByLabel("Mağaza adı", { exact: true }).fill(`Garage ${f.run}`);
    await page.getByLabel("Ana başlıq", { exact: true }).fill("Hər detalda\nmükəmməl qayğı.");
    await page.getByLabel("Loqo", { exact: true }).setInputFiles("branding/furycar/logo.png");
    await expect(page.locator('input[name="logoKey"]')).toHaveValue(/^images\//);
    await page.getByLabel("Favicon", { exact: true }).setInputFiles("branding/furycar/favicon.png");
    await expect(page.locator('input[name="faviconKey"]')).toHaveValue(/^images\//);
    const brandSaved = page.waitForResponse(r => r.url().endsWith("/api/admin/settings") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Bütün tənzimləmələri saxla", exact: true }).click(); const saved = await brandSaved; expect(saved.ok()).toBeTruthy();
    const branded = await saved.json();
    expect(branded.heroTitle).toBe("Hər detalda\nmükəmməl qayğı.");
    await page.goto("/"); await expect(page.getByRole("link", { name: `Garage ${f.run}`, exact: true }).first()).toBeVisible(); expect(await page.title()).toContain(`Garage ${f.run}`);
    await expectOptimizedSource(page.locator(".store-header .brand-logo"), `/api/media/${branded.logoKey}?public=1`);
    await expect(page.locator(".store-footer .brand-wordmark")).toHaveText(`Garage ${f.run}`);
    await expectOptimizedSource(page.locator(".store-footer .brand-symbol"), `/api/media/${branded.faviconKey}?public=1`);
    await expect(page.locator('head link[rel="icon"]').first()).toHaveAttribute("href", `/api/media/${branded.faviconKey}`);
    const customHome = { ...settings, brandName: `Garage ${f.run}`, logoKey: branded.logoKey, faviconKey: branded.faviconKey,
      heroTitle: `Avtomobiliniz üçün ${f.run}`, heroSubtitle: "Gündəlik qulluq üçün öz seçiminiz.", heroImageKey: branded.logoKey,
      showCategories: false, showFeatured: false, showNewArrivals: false };
    expect((await page.request.post("/api/admin/settings", { headers, data: { settings: customHome, rule: initial.rule } })).ok()).toBeTruthy();
    await page.goto("/"); await expect(page.locator("#home-title")).toHaveText(customHome.heroTitle);
    await expect(page.locator(".landing-hero-description")).toHaveText(customHome.heroSubtitle);
    await expectOptimizedSource(page.locator(".landing-hero-media img"), `/api/media/${branded.logoKey}?public=1`);
    await expect(page.locator("#categories-title, #featured-title, #arrivals-title")).toHaveCount(0);
    expect((await page.request.post("/api/admin/settings", { headers, data: { settings: { ...customHome, heroImageKey: null, showCategories: true, showFeatured: true, showNewArrivals: true }, rule: initial.rule } })).ok()).toBeTruthy();
    await page.goto("/"); await expectOptimizedSource(page.locator(".landing-hero-media img"), "/images/storefront/hero.webp");
    await expect(page.locator("#categories-title")).toBeVisible(); await expect(page.locator("#featured-title")).toBeVisible();
    const visitor = await browser.newContext(); const guest = await visitor.newPage();
    try {
      expect((await visitor.request.get(`/api/media/${branded.logoKey}`)).status()).toBe(200);
      expect((await visitor.request.get(`/api/media/${branded.faviconKey}`)).status()).toBe(200);
      await guest.setViewportSize({ width: 390, height: 844 }); await guest.goto("/"); await expect(guest.locator(".store-header .brand-logo")).toBeVisible();
      expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await guest.setViewportSize({ width: 1440, height: 1000 }); await guest.goto("/login"); await expect(guest.locator(".login-story .brand-wordmark")).toHaveText(`Garage ${f.run}`);
      await login(guest, f.otherEmail, f.password); await expect(guest.locator(".dashboard-sidebar .brand-wordmark")).toHaveText(`Garage ${f.run}`);
      await expectOptimizedSource(guest.locator(".dashboard-sidebar .brand-symbol"), `/api/media/${branded.faviconKey}?public=1`);
    } finally { await visitor.close(); }
    await page.goto("/admin/settings"); await expect(page.locator(".dashboard-sidebar .brand-wordmark")).toHaveText(`Garage ${f.run}`);
    if (product) {
      const updated = { id: product.id, name: product.name, slug: product.slug, description: product.description, categoryId: product.categoryId, status: "PUBLISHED", featured: product.featured, variants: product.variants.map((v: { id: string; name: string; sku: string; costMinor: number; priceMinor: number; discountMinor: number | null; commissionMinor: number | null; stock: number; lowStock: number; active: boolean }) => ({ id: v.id, name: v.name, sku: v.sku, costMinor: v.costMinor, priceMinor: 1750, discountMinor: v.discountMinor, commissionMinor: v.commissionMinor, stock: v.stock + 2, lowStock: v.lowStock, active: v.active })) };
      expect((await page.request.post("/api/admin/products", { headers, data: updated })).ok()).toBeTruthy();
      await page.goto(`/products/${product.slug}`); await expect(page.locator(".detail-price")).toContainText("17,50");
      expect((await page.request.post("/api/admin/products", { headers, data: { ...updated, status: "ARCHIVED" } })).ok()).toBeTruthy(); expect((await page.goto(`/products/${product.slug}`))?.status()).toBe(404);
    }
  } finally { expect((await page.request.post("/api/admin/settings", { headers, data: { settings, rule: initial.rule } })).ok()).toBeTruthy(); }
  expect(errors).toEqual([]);
});
test("responsive storefront has no horizontal overflow or console errors", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto("/"); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".landing-hero-media img")).toHaveJSProperty("complete", true);
    await expect.poll(() => page.locator(".landing-hero-media img").evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.evaluate(() => document.fonts.ready);
    const type = await page.evaluate(() => ({ body: getComputedStyle(document.querySelector(".storefront")!).fontSize,
      title: parseFloat(getComputedStyle(document.querySelector("#home-title")!).fontSize),
      copy: parseFloat(getComputedStyle(document.querySelector(".landing-hero-description")!).fontSize),
      font: document.fonts.check('16px Inter', 'ƏəĞğİıÖöŞşÇçÜü') }));
    expect(type.body).toBe("16px"); expect(type.title).toBeGreaterThanOrEqual(33); expect(type.title).toBeLessThanOrEqual(68); expect(type.copy).toBeGreaterThanOrEqual(15); expect(type.font).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/storefront-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  const menu = page.getByRole("button", { name: "Menyunu aç", exact: true });
  await expect(menu).toHaveAttribute("aria-expanded", "false"); await menu.click(); await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "Əsas menyu" }).getByRole("link", { name: "Bütün məhsullar", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/); await expect(menu).toHaveAttribute("aria-expanded", "false");
  const search = page.getByRole("textbox", { name: "Məhsul axtar", exact: true }); await expect(search).toBeVisible(); await search.fill("mikrofiber"); await search.press("Enter");
  await expect(page).toHaveURL(/\/products\?q=mikrofiber$/);
  for (const path of ["/products", "/cart", "/checkout"]) {
    await page.goto(path); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const field of await page.locator('.field input, .catalog-filters input').all()) expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(errors).toEqual([]);
});
test("upload feedback handles hosted payload errors and refuses oversized files before sending them", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password);
  let requests = 0;
  await page.route("**/api/admin/upload", route => { requests++; return route.fulfill({ status: 413, contentType: "text/plain", body: "FUNCTION_PAYLOAD_TOO_LARGE" }); });
  await page.goto("/admin/products"); await page.getByRole("button", { name: /redaktə et$/ }).first().click();
  const photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: "green" } }).png().toBuffer();
  const input = page.getByLabel("Məhsul şəkilləri", { exact: true });
  await input.setInputFiles({ name: "small.png", mimeType: "image/png", buffer: photo });
  await expect(page.locator(".image-editor").getByRole("alert")).toContainText("Şəkil ən çox 4 MB ola bilər.");
  await expect(input).toBeEnabled(); expect(requests).toBe(1);
  await input.setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) });
  await expect(input).toBeEnabled();
  await expect(page.locator(".image-editor").getByRole("alert")).toContainText("Şəkil ən çox 4 MB ola bilər.");
  expect(requests).toBe(1);
});
test("checkout becomes available after the owner configures the WhatsApp number", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password);
  const initial = await (await page.request.get("/api/admin/settings")).json();
  const settings = Object.fromEntries(Object.entries(initial.settings).filter(([key]) => !["id", "updatedAt"].includes(key)));
  const headers = { Origin: "http://localhost:3100" };
  try {
    expect((await page.request.post("/api/admin/settings", { headers, data: { settings: { ...settings, whatsapp: "" }, rule: initial.rule } })).ok()).toBeTruthy();
    const categories = await (await page.request.get("/api/admin/categories")).json();
    const created = await page.request.post("/api/admin/products", { headers, data: { name: `Checkout readiness ${f.run}`, slug: `checkout-readiness-${f.run}`, description: "Isolated readiness fixture", categoryId: categories[0].id, status: "PUBLISHED", featured: false, variants: [{ name: "Standart", sku: `READY-${f.run}`, priceMinor: 100, costMinor: 50, stock: 5 }] } });
    expect(created.ok()).toBe(true); const product = await created.json();
    const products = await (await page.request.get("/api/admin/products")).json(); const variantId = products.products.find((p: { id: string }) => p.id === product.id).variants[0].id;
    await page.addInitScript(item => localStorage.setItem("store-cart-v1", JSON.stringify([item])), { variantId, name: `Checkout readiness ${f.run}`, variant: "Standart", priceMinor: 100, quantity: 1, slug: `checkout-readiness-${f.run}` });
    await page.goto("/checkout");
    await expect(page.getByText("Sifariş qəbulu hələ aktiv deyil.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sifariş ver", exact: true })).toBeDisabled();
    expect((await page.request.post("/api/admin/settings", { headers, data: { settings, rule: initial.rule } })).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("button", { name: "Sifariş ver", exact: true })).toBeEnabled();
  } finally {
    expect((await page.request.post("/api/admin/settings", { headers, data: { settings, rule: initial.rule } })).ok()).toBeTruthy();
  }
});

test("CSV template, preview and confirmed import create drafts with variants and block duplicate reuploads", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const initial = await (await page.request.get("/api/admin/products")).json();
  const name = `CSV dəsmal ${f.run}`, slug = `csv-browser-${f.run}`;
  const input = csv([["name", "sku", "price", "cost", "stock", "slug", "variant", "description"],
    [name, `CSV-GREEN-${f.run}`, "14.99", "8.50", "7", slug, "Yaşıl", "Nəmi hopduran dəsmal."],
    [name, `CSV-GREY-${f.run}`, "15.99", "9.50", "4", slug, "Boz", "Nəmi hopduran dəsmal."]]);
  await page.getByRole("button", { name: "CSV idxalı", exact: true }).click();
  const panel = page.locator(".csv-import");
  const download = page.waitForEvent("download"); await panel.getByRole("button", { name: "CSV şablonunu yüklə" }).click();
  const template = await download; expect(template.suggestedFilename()).toBe("mehsul-idxal-sablonu.csv");
  expect(readFileSync((await template.path())!, "utf8")).toContain("Satış AZN");
  await panel.getByLabel("Ümumi kateqoriya", { exact: true }).selectOption(initial.categories[0].id);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from(input) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("heading", { name: "İdxal önizləməsi" })).toBeVisible();
  await expect(panel.getByText("1 məhsul · 2 variant · 0 yeni şəkil · Qaralama", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/admin/products")).json()).products.some((p: { slug: string }) => p.slug === slug)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const saved = page.waitForResponse(r => r.url().endsWith("/api/admin/product-import") && r.request().postDataJSON()?.mode === "import");
  await panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true }).click(); expect((await saved).ok()).toBeTruthy();
  await expect(panel.getByRole("status")).toContainText("1 məhsul və 2 variant qaralama kimi əlavə edildi");
  const created = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { slug: string }) => p.slug === slug);
  expect(created.status).toBe("DRAFT"); expect(created.variants).toHaveLength(2);
  expect(created.variants.map((v: { stock: number }) => v.stock).sort()).toEqual([4, 7]);
  expect((await (await page.request.get(`/api/catalog?q=${encodeURIComponent(name)}`)).json()).total).toBe(0);
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("SKU artıq mağazada var");
  await expect(panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true })).toBeDisabled();
  const invalid = input.replace('"7"', '""');
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.from(invalid) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("Stok sahəsi boşdur");
  await expect(panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true })).toBeDisabled();
});

test("CSV import API enforces roles, origin, body bounds and confirmation fields", async ({ page, browser }) => {
  const f = fixture(); await login(page, f.email, f.password);
  const headers = { Origin: "http://localhost:3100" };
  const input = { mode: "preview", csv: "name,sku,price,cost,stock\nCSV,X,1,0,0" };
  const guest = await browser.newContext();
  expect((await guest.request.post("/api/admin/product-import", { headers, data: input })).status()).toBe(401);
  expect((await guest.request.post("/api/admin/product-import-photo", { headers, data: {} })).status()).toBe(401); await guest.close();
  const partnerContext = await browser.newContext(); const partnerPage = await partnerContext.newPage(); await login(partnerPage, f.otherEmail, f.password);
  expect((await partnerPage.request.post("/api/admin/product-import", { headers, data: input })).status()).toBe(403);
  expect((await partnerPage.request.post("/api/admin/product-import-photo", { headers, data: {} })).status()).toBe(403); await partnerContext.close();
  expect((await page.request.post("/api/admin/product-import", { headers: { Origin: "https://outside.example" }, data: input })).status()).toBe(403);
  expect((await page.request.post("/api/admin/product-import", { headers: { ...headers, "Content-Type": "text/plain" }, data: "anything" })).status()).toBe(415);
  expect((await page.request.post("/api/admin/product-import", { headers, data: { ...input, mode: "import" } })).status()).toBe(400);
  expect((await page.request.post("/api/admin/product-import", { headers, data: { ...input, csv: "x".repeat(1024 * 1024 + 8192) } })).status()).toBe(413);
  expect((await page.request.post("/api/admin/product-import", { headers: { ...headers, "Content-Type": "application/json" }, data: "broken JSON" })).status()).toBe(400);
  expect((await page.request.post("/api/admin/product-import-photo", { headers: { Origin: "https://outside.example" }, data: {} })).status()).toBe(403);
  expect((await page.request.post("/api/admin/product-import-photo", { headers: { ...headers, "Content-Type": "text/plain" }, data: "anything" })).status()).toBe(415);
  expect((await page.request.post("/api/admin/product-import-photo", { headers, data: { sku: "test", url: "https://127.0.0.1/x.jpg" } })).status()).toBe(400);
  expect((await page.request.post("/api/admin/product-import-photo", { headers, data: { sku: "x".repeat(9000) } })).status()).toBe(413);
});

const birmarketPhoto = "https://strgimgr.umico.az/img/product/1680/407af88f-a282-4448-872e-a192c0491806.jpeg";
test("Full CSV imports a real CDN photo into private storage and the published storefront", async ({ page, browser }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const initial = await (await page.request.get("/api/admin/products")).json();
  const slug = `csv-photo-${f.run}`, sku = `PHOTO-${f.run}`, name = `CSV photo ${f.run}`;
  const input = csv([["name", "sku", "price", "cost", "stock", "slug", "image_urls", "source_url", "source_price_azn", "source_description"], [name, sku, "14.99", "7", "5", slug, birmarketPhoto, "https://birmarket.az/product/2850424-test", "99.99", "Ignored source marketing"]]);
  await page.getByRole("button", { name: "CSV idxalı", exact: true }).click(); const panel = page.locator(".csv-import");
  await panel.getByLabel("Ümumi kateqoriya", { exact: true }).selectOption(initial.categories[0].id);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "birmarket-full.csv", mimeType: "text/csv", buffer: Buffer.from(input) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click(); await expect(panel.getByText("1 məhsul · 1 variant · 1 yeni şəkil · Qaralama", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true }).click();
  await expect(panel.getByText("1 şəkil əlavə edildi · 0 şəkil artıq mövcud idi · 0 xəta.", { exact: true })).toBeVisible({ timeout: 30000 });
  const product = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { slug: string }) => p.slug === slug);
  expect(product.status).toBe("DRAFT"); expect(product.images).toHaveLength(1); expect(product.variants[0]).toMatchObject({ priceMinor: 1499, costMinor: 700, stock: 5 });
  const path = `/api/media/${product.images[0].key}`;
  const owner = await page.request.get(path); expect(owner.status()).toBe(200); expect(owner.headers()["content-type"]).toContain("image/webp");
  const guest = await browser.newContext(); expect((await guest.request.get(path)).status()).toBe(401);
  const variant = product.variants[0];
  const publish = await page.request.post("/api/admin/products", { headers: { Origin: "http://localhost:3100" }, data: { id: product.id, name, slug, description: product.description, categoryId: product.categoryId, status: "PUBLISHED", featured: false, variants: [{ id: variant.id, name: variant.name, sku, priceMinor: 1499, costMinor: 700, stock: 5 }] } });
  expect(publish.status()).toBe(200); expect((await guest.request.get(path)).status()).toBe(200);
  const shop = await guest.newPage(); await shop.goto(`/products/${slug}`);
  const image = shop.locator(".detail-image img"); await expect(image).toBeVisible(); await expectOptimizedSource(image, `${path}?public=1`);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await guest.close();
});

test("photos-only CSV fills an existing product, retries failed images and preserves catalog data", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const sku = `CSV-GREEN-${f.run}`;
  const existing = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { slug: string }) => p.slug === `csv-browser-${f.run}`);
  let metadataImports = 0, photoRequests = 0;
  page.on("request", request => { if (request.url().endsWith("/api/admin/product-import") && request.postDataJSON()?.mode === "import") metadataImports++; });
  await page.route("**/api/admin/product-import-photo", route => { photoRequests++; return photoRequests === 1 ? route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Şəkil mənbəyi müvəqqəti əlçatan deyil." }) }) : route.continue(); });
  await page.getByRole("button", { name: "CSV idxalı", exact: true }).click(); const panel = page.locator(".csv-import");
  await panel.getByLabel("İdxal növü", { exact: true }).selectOption("photos");
  const input = csv([["sku", "image_urls", "price", "cost", "stock", "source_price_azn"], [sku, birmarketPhoto, "", "", "", "99.99"]]);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "existing-photos.csv", mimeType: "text/csv", buffer: Buffer.from(input) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click(); await expect(panel.getByText("1 məhsul · 1 variant · 1 yeni şəkil", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Şəkilləri əlavə et", exact: true }).click();
  await expect(panel.getByText("0 şəkil əlavə edildi · 0 şəkil artıq mövcud idi · 1 xəta.", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Alınmayan şəkilləri yenidən yoxla", exact: true }).click();
  await expect(panel.getByText("1 şəkil əlavə edildi · 0 şəkil artıq mövcud idi · 0 xəta.", { exact: true })).toBeVisible({ timeout: 30000 });
  expect(metadataImports).toBe(0); expect(photoRequests).toBe(2);
  const updated = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { id: string }) => p.id === existing.id);
  expect(updated.images).toHaveLength(1); expect(updated.variants).toEqual(existing.variants); expect(updated.status).toBe(existing.status); expect(updated.description).toBe(existing.description);
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByText("Bu fayldakı şəkillər artıq məhsullara əlavə edilib.", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Şəkilləri əlavə et", exact: true })).toBeDisabled();
});

test("product delete confirms or cancels, hides public pages/photos, and restores the original product as a draft", async ({ page, browser }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const name = `CSV photo ${f.run}`;
  const original = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { name: string }) => p.name === name);
  expect(original.status).toBe("PUBLISHED"); expect(original.images).toHaveLength(1);
  const row = page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
  page.once("dialog", async dialog => { expect(dialog.message()).toContain(name); await dialog.dismiss(); });
  await row.getByRole("button", { name: `${name} sil`, exact: true }).click(); await expect(row).toBeVisible();
  expect((await (await page.request.get("/api/admin/products")).json()).products.some((p: { id: string }) => p.id === original.id)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  page.once("dialog", dialog => dialog.accept());
  const deleted = page.waitForResponse(response => response.url().endsWith("/api/admin/product-trash") && response.request().method() === "POST");
  await row.getByRole("button", { name: `${name} sil`, exact: true }).click(); expect((await deleted).status()).toBe(200);
  await expect(row).toHaveCount(0); await expect(page.getByText("1 məhsul silindi. Silinmişlər bölməsindən bərpa edə bilərsiniz.", { exact: true })).toBeVisible();
  const guest = await browser.newContext();
  expect((await guest.request.get(`/products/${original.slug}`)).status()).toBe(404);
  expect((await guest.request.get(`/api/media/${original.images[0].key}`)).status()).toBe(401);
  expect((await (await guest.request.get(`/api/catalog?q=${encodeURIComponent(name)}`)).json()).total).toBe(0);
  const exported = await page.request.get("/api/admin/export?type=products"); expect(await exported.text()).not.toContain(original.variants[0].sku);
  await page.getByRole("link", { name: /^Silinmişlər/ }).click();
  await expect(page.getByRole("heading", { name: /Silinmiş məhsullar/ })).toBeVisible();
  const trashed = page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) }); await expect(trashed).toBeVisible();
  await trashed.getByRole("button", { name: `${name} bərpa et`, exact: true }).click(); await expect(trashed).toHaveCount(0);
  await page.getByRole("link", { name: "Kataloqa qayıt", exact: true }).click();
  const restoredRow = page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) }); await expect(restoredRow).toBeVisible(); await expect(restoredRow.getByText("Qaralama", { exact: true })).toBeVisible();
  const restored = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { id: string }) => p.id === original.id);
  expect(restored.variants).toEqual(original.variants); expect(restored.images).toEqual(original.images); expect(restored.slug).toBe(original.slug); expect(restored.description).toBe(original.description);
  expect((await guest.request.get(`/products/${restored.slug}`)).status()).toBe(404); await guest.close();
});

test("selected products can be deleted together and restored from trash", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const initial = await (await page.request.get("/api/admin/products")).json();
  const names = [`Bulk deletion A ${f.run}`, `Bulk deletion B ${f.run}`];
  for (let n = 0; n < names.length; n++) {
    const create = await page.request.post("/api/admin/products", { headers: { Origin: "http://localhost:3100" }, data: { name: names[n], slug: `bulk-delete-${f.run}-${n}`, description: "Deletion test", categoryId: initial.categories[0].id, status: "DRAFT", featured: false, variants: [{ name: "Standart", sku: `BULK-DELETE-${f.run}-${n}`, priceMinor: 1000, costMinor: 500, stock: 3 }] } }); expect(create.status()).toBe(200);
  }
  await page.reload();
  for (const name of names) await page.getByRole("checkbox", { name: `${name} seç`, exact: true }).check();
  page.once("dialog", async dialog => { expect(dialog.message()).toContain("2 məhsul"); await dialog.accept(); });
  await page.getByRole("button", { name: "Seçilənləri sil", exact: true }).click();
  for (const name of names) await expect(page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) })).toHaveCount(0);
  await expect(page.getByText("2 məhsul silindi. Silinmişlər bölməsindən bərpa edə bilərsiniz.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /^Silinmişlər/ }).click();
  for (const name of names) await page.getByRole("checkbox", { name: `${name} seç`, exact: true }).check();
  await page.getByRole("button", { name: "Seçilənləri bərpa et", exact: true }).click();
  for (const name of names) await expect(page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) })).toHaveCount(0);
  await page.getByRole("link", { name: "Kataloqa qayıt", exact: true }).click();
  for (const name of names) await expect(page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) }).getByText("Qaralama", { exact: true })).toBeVisible();
});

test("product trash API checks administrator role, origin, JSON size and validated actions", async ({ page, browser }) => {
  const f = fixture(), headers = { Origin: "http://localhost:3100" }, data = { action: "delete", ids: ["nonexistent"] };
  const guest = await browser.newContext(); expect((await guest.request.post("/api/admin/product-trash", { headers, data })).status()).toBe(401); await guest.close();
  const partner = await browser.newContext(); const portal = await partner.newPage(); await login(portal, f.otherEmail, f.password);
  for (const action of ["delete", "restore"]) expect((await portal.request.post("/api/admin/product-trash", { headers, data: { ...data, action } })).status()).toBe(403); await partner.close();
  await login(page, f.email, f.password);
  expect((await page.request.post("/api/admin/product-trash", { headers: { Origin: "https://outside.example" }, data })).status()).toBe(403);
  expect((await page.request.post("/api/admin/product-trash", { headers: { ...headers, "Content-Type": "text/plain" }, data: "text" })).status()).toBe(415);
  for (const invalid of [{ action: "delete", ids: [] }, { action: "delete", ids: Array.from({ length: 101 }, () => "x") }, { action: "erase", ids: ["x"] }, { ...data, status: "PUBLISHED" }]) expect((await page.request.post("/api/admin/product-trash", { headers, data: invalid })).status()).toBe(400);
  expect((await page.request.post("/api/admin/product-trash", { headers, data })).status()).toBe(404);
  expect((await page.request.post("/api/admin/product-trash", { headers, data: { action: "delete", ids: ["x".repeat(20000)] } })).status()).toBe(413);
});

test("Temu extension CSV imports the real provided product photo with owner AZN prices", async ({ page, browser }) => {
  const f = fixture(); await login(page, f.email, f.password); await page.goto("/admin/products");
  const initial = await (await page.request.get("/api/admin/products")).json();
  const name = `Temu CSV fixture ${f.run}`, slug = `temu-browser-${f.run}`, imageUrl = "https://img.kwcdn.com/product/fancy/e7a47b3a-c07f-4fd8-b295-7077b607d199.jpg";
  // Financial values and metadata are test fixtures; the image is the actual
  // public CDN photo supplied by the owner, fetched by the real server route.
  const product = updateProduct(normalizeProduct({ name, sourceUrl: "https://www.temu.com/az-en/towel-g-601105384433706.html?tracking=private", sourcePrice: "2.99", currency: "USD", imageUrls: [imageUrl] }), { price: "14.99", cost: "7", stock: "3", sku: `TM-601105384433706-${f.run}`, slug });
  await page.getByRole("button", { name: "CSV idxalı", exact: true }).click(); const panel = page.locator(".csv-import");
  await panel.getByLabel("Ümumi kateqoriya", { exact: true }).selectOption(initial.categories[0].id);
  await panel.getByLabel("CSV faylı", { exact: true }).setInputFiles({ name: "temu-full.csv", mimeType: "text/csv", buffer: Buffer.from(fullCsv([product])) });
  await panel.getByRole("button", { name: "Faylı yoxla", exact: true }).click();
  await expect(panel.getByText("1 məhsul · 1 variant · 1 yeni şəkil · Qaralama", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Qaralamaları əlavə et", exact: true }).click();
  await expect(panel.getByText("1 şəkil əlavə edildi · 0 şəkil artıq mövcud idi · 0 xəta.", { exact: true })).toBeVisible({ timeout: 30000 });
  const saved = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { slug: string }) => p.slug === slug);
  expect(saved.status).toBe("DRAFT"); expect(saved.variants[0]).toMatchObject({ priceMinor: 1499, costMinor: 700, stock: 3 }); expect(saved.images).toHaveLength(1);
  const path = `/api/media/${saved.images[0].key}`, guest = await browser.newContext();
  expect((await guest.request.get(path)).status()).toBe(401);
  expect((await page.request.post("/api/admin/product-bulk", { headers: { Origin: "http://localhost:3100" }, data: { ids: [saved.id], status: "PUBLISHED" } })).status()).toBe(200);
  const photo = await guest.request.get(path); expect(photo.status()).toBe(200); expect(photo.headers()["content-type"]).toContain("image/webp");
  const shop = await guest.newPage(); await shop.goto(`/products/${slug}`); const shown = shop.locator(".detail-image img"); await expectOptimizedSource(shown, `${path}?public=1`);
  await expect(shown).toBeVisible(); await expect.poll(() => shown.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const publicData = await (await guest.request.get(`/api/catalog?q=${encodeURIComponent(name)}`)).text(); expect(publicData).not.toContain("costMinor"); expect(publicData).not.toContain("img.kwcdn.com");
  await guest.close();
});

test("delivery before payment stays open and the last recorded payment completes the referred order automatically", async ({ page, browser }) => {
  const f = fixture(), origin = { Origin: "http://localhost:3100" }; await login(page, f.email, f.password);
  const initial = await (await page.request.get("/api/admin/products")).json(), slug = `simple-order-${f.run}`;
  expect((await page.request.post("/api/admin/products", { headers: origin, data: { name: `Simple order fixture ${f.run}`, slug, description: "Test fixture", categoryId: initial.categories[0].id, status: "PUBLISHED", featured: false, variants: [{ name: "Standart", sku: `SIMPLE-${f.run}`, costMinor: 500, priceMinor: 1500, stock: 4 }] } })).status()).toBe(200);
  const product = (await (await page.request.get("/api/admin/products")).json()).products.find((p: { slug: string }) => p.slug === slug);
  const customer = await browser.newContext();
  const created = await customer.request.post("/api/orders", { headers: origin, data: { idempotencyKey: crypto.randomUUID(), name: "Simple order test customer", phone: "+994500006666", city: "Bakı", address: "Test address 15", referralCode: `WASH${f.run.toUpperCase()}`, items: [{ variantId: product.variants[0].id, quantity: 1 }] } }); expect(created.status()).toBe(200);
  const { reference } = await created.json(); const order = (await (await page.request.get("/api/admin/orders")).json()).find((o: { reference: string }) => o.reference === reference);
  await page.goto("/admin/orders"); const row = page.getByRole("row").filter({ hasText: reference });
  await row.getByRole("button", { name: `${reference} Təsdiqlə`, exact: true }).click(); await expect(row.getByRole("button", { name: `${reference} Çatdırıldı`, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.getByRole("button", { name: `${reference} Çatdırıldı`, exact: true }).click();
  await expect(row.locator(".badge").filter({ hasText: /^Çatdırılıb$/ })).toBeVisible(); await expect(row.getByText("Ödəniş gözlənilir", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/admin/commissions")).json()).filter((c: { orderId: string }) => c.orderId === order.id)).toHaveLength(0);
  await row.getByRole("button", { name: `${reference} bax`, exact: true }).click();
  await page.getByLabel("Əməliyyat məbləği (AZN)", { exact: true }).fill("15.00"); await page.getByLabel("Üsul", { exact: true }).fill("Nağd"); await page.getByLabel("Tranzaksiya / əməliyyat istinadı", { exact: true }).fill(`LATE-${f.run}`);
  const paid = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().postDataJSON()?.action === "payment");
  await page.getByRole("button", { name: "Maliyyə əməliyyatını qeydə al", exact: true }).click(); expect((await paid).status()).toBe(200);
  await expect(row.getByText("Tamamlanıb", { exact: true })).toBeVisible();
  expect((await (await page.request.get("/api/admin/commissions")).json()).filter((c: { orderId: string }) => c.orderId === order.id)).toHaveLength(1);
  await page.locator(".order-extra-actions summary").click(); await expect(page.locator('select[name="status"] option[value="RETURNED"]')).toHaveCount(1);
  await customer.close();
});
