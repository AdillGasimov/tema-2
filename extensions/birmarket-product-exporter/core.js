export const MAX_PRODUCTS = 200;
export const STORE_HEADERS = ["name", "sku", "price", "cost", "stock", "category", "description", "slug", "variant", "discount"];
export const FULL_HEADERS = [...STORE_HEADERS, "source_url", "image_urls", "source_price_azn", "source_currency", "source_category", "source_description", "brand", "source_sku", "specifications", "source_variants", "scraped_at", "source_price"];
const text = (value, max = 10000) => typeof value === "string" ? value.slice(0, max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim() : "";

export function productSource(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    let sourceId, marketplace;
    if (["birmarket.az", "www.birmarket.az"].includes(u.hostname)) {
      sourceId = /^\/(?:az\/|ru\/|en\/)?product\/(\d{1,20})(?:-|\/|$)/.exec(u.pathname)?.[1]; marketplace = "birmarket";
    } else if (["temu.com", "www.temu.com"].includes(u.hostname)) {
      const pathId = /(?:\/|-)g-(\d{5,20})\.html$/.exec(u.pathname)?.[1], queryId = u.searchParams.get("goods_id");
      if (pathId && queryId && pathId !== queryId) return null;
      if (pathId) sourceId = pathId;
      else if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?goods(?:\.html)?$/i.test(u.pathname) && /^\d{5,20}$/.test(queryId || "")) sourceId = queryId;
      marketplace = "temu";
    }
    if (!sourceId) return null;
    u.hash = ""; u.search = "";
    if (marketplace === "temu" && !/(?:\/|-)g-\d{5,20}\.html$/.test(u.pathname)) u.searchParams.set("goods_id", sourceId);
    return { id: marketplace === "temu" ? `temu-${sourceId}` : sourceId, sourceId, marketplace, url: u.href };
  } catch { return null; }
}
export function productId(url) { return productSource(url)?.id ?? null; }

export function normalizeProduct(raw) {
  const source = raw && typeof raw === "object" ? productSource(raw.sourceUrl) : null;
  if (!source) throw new Error("Birmarket və ya Temu məhsul səhifəsi tapılmadı.");
  const { id, sourceId, marketplace } = source;
  const name = text(raw.name, 500); if (!name) throw new Error("Məhsulun adı tapılmadı. Səhifənin yüklənməsini gözləyin.");
  const specifications = (Array.isArray(raw.specifications) ? raw.specifications : []).slice(0, 100)
    .map(p => ({ name: text(p?.name, 200), value: text(p?.value, 1000) })).filter(p => p.name && p.value);
  const images = [...new Set((Array.isArray(raw.imageUrls) ? raw.imageUrls : []).filter(s => {
    try { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password && s.length < 3000; } catch { return false; }
  }))].slice(0, 30);
  const letters = { ə: "e", ı: "i", ö: "o", ü: "u", ğ: "g", ç: "c", ş: "s" };
  const slug = name.toLocaleLowerCase("az").replace(/[əıöüğçş]/g, c => letters[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 140);
  return {
    id, marketplace, sourceId, sourceUrl: source.url, name, sourceSku: text(String(raw.sourceSku ?? sourceId), 100), brand: text(raw.brand, 200),
    sourcePrice: text(String(raw.sourcePrice ?? ""), 40), currency: text(raw.currency, 10),
    sourceCategory: text(raw.sourceCategory, 500), description: text(raw.description), specifications,
    imageUrls: images, sourceVariants: (Array.isArray(raw.sourceVariants) ? raw.sourceVariants : []).slice(0, 50).map(v => text(v, 200)).filter(Boolean),
    scrapedAt: text(raw.scrapedAt, 100) || new Date().toISOString(),
    storeName: name.slice(0, 160).replace(/[\uD800-\uDBFF]$/, ""), sku: `${marketplace === "temu" ? "TM" : "BM"}-${sourceId}`, price: "", cost: "", stock: "", category: "", slug: `${marketplace === "temu" ? "temu-" : ""}${slug || "mehsul"}-${sourceId}`, variant: "Standart", discount: "", descriptionOverride: null,
  };
}
export function mergeProduct(existing, incoming) {
  const normalized = normalizeProduct(incoming);
  if (!existing) return normalized;
  for (const key of ["storeName", "sku", "price", "cost", "stock", "category", "slug", "variant", "discount", "descriptionOverride"]) normalized[key] = existing[key] ?? normalized[key];
  return normalized;
}
export function updateProduct(product, changes) {
  const copy = { ...product };
  const limits = { storeName: 160, sku: 80, price: 20, cost: 20, stock: 12, category: 160, slug: 180, variant: 100, discount: 20, descriptionOverride: 10000 };
  for (const [key, max] of Object.entries(limits)) if (Object.hasOwn(changes, key)) copy[key] = text(changes[key], max);
  return copy;
}
export function storeDescription(product) {
  if (typeof product.descriptionOverride === "string") return product.descriptionOverride;
  return [product.description || product.name, product.specifications.map(p => `${p.name}: ${p.value}`).join("\n")].filter(Boolean).join("\n\n");
}
function amount(value, positive) {
  const s = String(value ?? "").trim();
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(s)) return false;
  const [whole, fraction = ""] = s.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minor <= 100000000 && (!positive || minor > 0);
}
export function storeErrors(product) {
  const errors = [];
  if (!product.storeName || product.storeName.length < 2 || product.storeName.length > 160) errors.push("Məhsul adı 2–160 simvol olmalıdır");
  if (!product.sku || product.sku.length > 80) errors.push("SKU tələb olunur");
  if (!amount(product.price, true)) errors.push("Satış qiymətini AZN ilə yazın");
  if (!amount(product.cost, false)) errors.push("Həqiqi alış maya dəyərini AZN ilə yazın");
  if (!/^\d{1,7}$/.test(product.stock) || Number(product.stock) > 1000000) errors.push("Stok sayını tam ədəd kimi yazın");
  if (!product.variant) errors.push("Variant adı tələb olunur");
  if (product.slug && !/^[a-z0-9-]+$/.test(product.slug)) errors.push("URL adı kiçik latın hərfləri və tire ilə olmalıdır");
  if (storeDescription(product).length > 10000) errors.push("Mağaza təsviri 10000 simvoldan uzundur");
  if (product.discount) {
    const n = s => Number(String(s).replace(",", "."));
    if (!amount(product.discount, false) || n(product.discount) >= n(product.price)) errors.push("Endirim satış qiymətindən az olmalıdır");
  }
  return errors;
}
export function csv(rows) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let s = String(value ?? "");
    if (/^[\s]*[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n") + "\r\n";
}
function storeRow(p) {
  return [p.storeName, p.sku, p.price, p.cost, p.stock, p.category, storeDescription(p), p.slug, p.variant, p.discount];
}
export function fullCsv(products) {
  return csv([FULL_HEADERS, ...products.map(p => [...storeRow(p), p.sourceUrl, p.imageUrls.join(" | "), p.currency?.toUpperCase() === "AZN" ? p.sourcePrice : "", p.currency, p.sourceCategory, p.description, p.brand, p.sourceSku, JSON.stringify(p.specifications), p.sourceVariants.join(" | "), p.scrapedAt, p.sourcePrice])]);
}
export function storeCsvBatches(products) {
  if (!products.length) throw new Error("Əvvəl məhsul yadda saxlayın.");
  const bad = products.map(p => ({ p, errors: storeErrors(p) })).filter(p => p.errors.length);
  if (bad.length) throw new Error(`${bad.length} məhsulda məlumat çatışmır. ${bad[0].p.storeName}: ${bad[0].errors.join("; ")}.`);
  const skus = new Set(), groups = new Map();
  for (const p of products) {
    if (skus.has(p.sku)) throw new Error(`SKU təkrarlanır: ${p.sku}`); skus.add(p.sku);
    const key = p.slug || p.storeName, group = groups.get(key) || [];
    if (group.length && (group[0].storeName !== p.storeName || storeDescription(group[0]) !== storeDescription(p) || group[0].category !== p.category || group.some(v => v.variant === p.variant))) throw new Error(`Eyni URL adı olan variantları yoxlayın: ${key}`);
    group.push(p); if (group.length > 30) throw new Error("Bir məhsulda ən çox 30 variant ola bilər."); groups.set(key, group);
  }
  const result = [], encoder = new TextEncoder(), header = csv([STORE_HEADERS]), maxBytes = 512 * 1024;
  let batch = header, count = 0, bytes = encoder.encode(header).byteLength;
  for (const group of groups.values()) {
    const rows = csv(group.map(storeRow)).slice(1), size = encoder.encode(rows).byteLength;
    if (encoder.encode(header).byteLength + size > maxBytes) throw new Error("Bir məhsulun variantları 512 KB həddini keçir. Mağaza təsvirini qısaldın.");
    if (count && (count + group.length > 50 || bytes + size > maxBytes)) { result.push(batch); batch = header; count = 0; bytes = encoder.encode(header).byteLength; }
    batch += rows; count += group.length; bytes += size;
  }
  if (count) result.push(batch);
  return result;
}
