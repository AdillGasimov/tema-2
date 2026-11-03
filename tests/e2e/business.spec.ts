import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import sharp from "sharp";
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
  await page.getByLabel("SKU", { exact: true }).fill(`E2E-${f.run}`); await page.getByLabel("Stok sayı").fill("10");
  await page.getByLabel("Alış maya dəyəri (AZN)", { exact: true }).fill("5.00"); await page.getByLabel("Satış qiyməti (AZN)", { exact: true }).fill("15.00");
  await page.getByRole("button", { name: "Yadda saxla", exact: true }).click();
  await expect(page.getByLabel("Məhsul şəkilləri", { exact: true })).toBeVisible();
  const photo = await sharp({ create: { width: 300, height: 300, channels: 3, background: "#a9c182" } }).png().toBuffer();
  await page.getByLabel("Məhsul şəkilləri", { exact: true }).setInputFiles({ name: "test-towel.png", mimeType: "image/png", buffer: photo });
  await expect(page.locator(".admin-image-grid img")).toBeVisible();
  const photoPath = await page.locator(".admin-image-grid img").first().getAttribute("src");
  expect(photoPath).toBeTruthy(); const photoUrl = new URL(photoPath!, page.url()).toString();
  const privateVisitor = await browser.newContext();
  expect((await privateVisitor.request.get(photoUrl)).status()).toBe(401);
  const ownerPhoto = await page.request.get(photoUrl); expect(ownerPhoto.status()).toBe(200);
  expect(ownerPhoto.headers()["cache-control"]).toBe("private, no-store");
  await page.locator('select[name="status"]').selectOption("PUBLISHED");
  const published = page.waitForResponse(r => r.url().endsWith("/api/admin/products") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Yadda saxla", exact: true }).click(); expect((await published).ok()).toBeTruthy();
  expect((await privateVisitor.request.get(photoUrl)).status()).toBe(200); await privateVisitor.close();
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
  await shop.goto(`/?ref=${code}`); await refResponse;
  await shop.goto(`/products/e2e-${f.run}`); await expect(shop.getByRole("heading", { name, exact: true })).toBeVisible();
  await shop.getByRole("button", { name: "Səbətə əlavə et", exact: true }).click(); await shop.goto("/checkout");
  await expect(shop.getByLabel("Referal kodu (istəyə bağlı)", { exact: true })).toHaveValue(code);
  await shop.getByLabel("Ad və soyad", { exact: true }).fill("E2E Müştəri"); await shop.getByLabel("Telefon nömrəsi", { exact: true }).fill("+994500005555");
  await shop.getByLabel("Şəhər və ya bölgə", { exact: true }).selectOption("Bakı"); await shop.getByLabel("Çatdırılma ünvanı", { exact: true }).fill("Test küçəsi 10, mənzil 2");
  await shop.locator('input[type="checkbox"]').check();
  await customer.route("https://wa.me/**", route => route.fulfill({ body: "WhatsApp handoff intercepted by test." }));
  const popupPromise = shop.waitForEvent("popup"); await shop.getByRole("button", { name: "Sifariş ver", exact: true }).click(); const popup = await popupPromise;
  await expect(shop.getByTestId("order-reference")).toBeVisible(); const reference = await shop.getByTestId("order-reference").innerText();
  await popup.waitForURL(/https:\/\/wa.me\//); expect(decodeURIComponent(popup.url())).toContain(reference); expect(decodeURIComponent(popup.url())).toContain(code);
  const adminOrders = await (await page.request.get("/api/admin/orders")).json(); const order = adminOrders.find((o: { reference: string }) => o.reference === reference); expect(order.status).toBe("WHATSAPP_PENDING"); expect(order.paymentStatus).toBe("UNPAID");
  await page.goto("/admin/orders"); await page.getByRole("button", { name: `${reference} bax`, exact: true }).click();
  const changeStatus = async (status: string) => { await page.locator('.order-detail-body select[name="status"]').selectOption(status); const r = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().method() === "POST"); await page.getByRole("button", { name: "Statusu yenilə", exact: true }).click(); expect((await r).ok()).toBeTruthy(); await expect(page.locator(".order-detail-body")).toBeVisible(); };
  for (const s of ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"]) await changeStatus(s);
  await page.getByLabel("Əməliyyat məbləği (AZN)", { exact: true }).fill("15.00"); await page.getByLabel("Üsul", { exact: true }).fill("Nağd"); await page.getByLabel("Tranzaksiya / əməliyyat istinadı", { exact: true }).fill(`CASH-${f.run}`);
  const paid = page.waitForResponse(r => r.url().endsWith("/api/admin/orders") && r.request().method() === "POST"); await page.getByRole("button", { name: "Maliyyə əməliyyatını qeydə al", exact: true }).click(); expect((await paid).ok()).toBeTruthy();
  await changeStatus("COMPLETED");
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
  await login(page, f.otherEmail, f.password);
  expect((await page.request.get("/api/admin/products")).status()).toBe(403);
  expect((await page.request.post("/api/admin/commissions", { headers: { Origin: "http://localhost:3100" }, data: {} })).status()).toBe(403);
  const p = await (await page.request.get("/api/partner?partnerId=someone-else")).json(); expect(p.partner.id).toBe(f.otherId); expect(p.orders).toHaveLength(0);
  expect((await page.request.get(`/api/cards?ids=${f.foreignId}&format=png`)).status()).toBe(403);
  const adminContext = await browser.newContext(); const admin = await adminContext.newPage(); await login(admin, f.email, f.password);
  expect((await admin.request.post("/api/admin/expenses", { headers: { Origin: "https://evil.example" }, data: {} })).status()).toBe(403);
  expect((await admin.request.post("/api/admin/products", { headers: { Origin: "http://localhost:3100" }, data: { name: "invalid" } })).status()).toBe(400);
  expect((await admin.request.get("/api/admin/export?type=orders")).headers()["content-type"]).toContain("text/csv");
  await adminContext.close();
  const codeContext = await browser.newContext(); const codePage = await codeContext.newPage(); await login(codePage, f.foreignCode, f.password); expect((await (await codePage.request.get("/api/partner")).json()).partner.id).toBe(f.foreignId); await codeContext.close();
});
test("all management pages render; rebranding and product changes apply without a rebuild", async ({ page }) => {
  const f = fixture(); await login(page, f.email, f.password); const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  for (const section of ["overview", "products", "categories", "inventory", "orders", "customers", "partners", "cards", "commissions", "payouts", "analytics", "expenses", "reports", "disputes", "notifications", "integrations", "audit", "settings"]) {
    const response = await page.goto(`/admin/${section}`); expect(response?.status()).toBe(200); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  const initial = await (await page.request.get("/api/admin/settings")).json();
  const settings = Object.fromEntries(Object.entries(initial.settings).filter(([key]) => !["id", "updatedAt"].includes(key)));
  const products = await (await page.request.get("/api/admin/products")).json(); const product = products.products.find((p: { slug: string }) => p.slug === `e2e-${f.run}`);
  const headers = { Origin: "http://localhost:3100" };
  try {
    const saved = await page.request.post("/api/admin/settings", { headers, data: { settings: { ...settings, brandName: `Garage ${f.run}`, logoKey: product?.images[0]?.key ?? null }, rule: initial.rule } }); expect(saved.ok()).toBeTruthy();
    await page.goto("/"); await expect(page.getByRole("link", { name: `Garage ${f.run}`, exact: true }).first()).toBeVisible(); expect(await page.title()).toContain(`Garage ${f.run}`);
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
  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.goto("/"); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: `test-results/storefront-${width}.png`, fullPage: true }); }
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
    await page.addInitScript(() => localStorage.setItem("store-cart-v1", JSON.stringify([{ variantId: "readiness-only", name: "Checkout readiness", variant: "Standart", priceMinor: 100, quantity: 1, slug: "readiness-only" }])));
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
