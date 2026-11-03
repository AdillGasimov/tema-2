// This function is self-contained because Chrome serializes it into the product tab.
export function extractBirmarketProduct() {
  const url = new URL(location.href);
  const match = /^\/(?:az\/|ru\/|en\/)?product\/(\d+)(?:-|\/|$)/.exec(url.pathname);
  if (url.protocol !== "https:" || !["birmarket.az", "www.birmarket.az"].includes(url.hostname) || !match) throw new Error("Birmarket-də məhsul səhifəsini açın.");
  const id = match[1], clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const meta = key => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute("content") || "";
  const candidates = [];
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 8 || candidates.length > 100) return;
    if (Array.isArray(value)) { value.slice(0, 500).forEach(v => walk(v, depth + 1)); return; }
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.includes("Product")) candidates.push(value);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item"]) if (value[key]) walk(value[key], depth + 1);
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    if (script.textContent.length > 1000000) return;
    try { walk(JSON.parse(script.textContent)); } catch { /* malformed metadata: use the product DOM */ }
  });
  const belongs = p => String(p.sku ?? "") === id || [p.url, p["@id"], p.offers?.url].some(v => {
    try { return /^\/(?:az\/|ru\/|en\/)?product\/(\d+)/.exec(new URL(v, location.href).pathname)?.[1] === id; } catch { return false; }
  });
  const product = candidates.find(belongs) || null;
  if (!product && !document.querySelector('[data-info="product-page"], [data-info="product-page-body"]')) throw new Error("Məhsul məlumatları yüklənməyib. Səhifəni açıb yüklənməsini gözləyin.");
  const name = clean(product?.name || document.querySelector("h1")?.textContent);
  if (!name) throw new Error("Məhsul adı tapılmadı.");
  const specifications = [], seenSpecs = new Set();
  document.querySelectorAll('[data-info="product-features-row"], [data-info="product-short-info-row"]').forEach(row => {
    const key = clean(row.querySelector('[data-info="product-features-name"], [data-info="product-short-info-name"]')?.textContent).replace(/:$/, "");
    const value = clean(row.querySelector('[data-info="product-features-value"], [data-info="product-short-info-value"]')?.textContent);
    const signature = `${key}\0${value}`;
    if (key && value && !seenSpecs.has(signature) && specifications.length < 100) { seenSpecs.add(signature); specifications.push({ name: key, value }); }
  });
  const descriptionElement = document.querySelector('[data-info="product-description-block"] [itemprop="description"]:not([data-info="product-description-empty"]), [data-info="product-description-text"]');
  const description = descriptionElement?.innerText?.trim() || "";
  const offers = Array.isArray(product?.offers) ? product.offers : product?.offers ? [product.offers] : [];
  const offer = offers.find(o => o.price !== undefined || o.lowPrice !== undefined) || {};
  const rawImages = [];
  const addImage = value => { if (typeof value === "string") rawImages.push(value); else if (value?.url) rawImages.push(value.url); else if (value?.contentUrl) rawImages.push(value.contentUrl); };
  if (Array.isArray(product?.image)) product.image.forEach(addImage); else addImage(product?.image);
  document.querySelectorAll('[data-info="product-gallery"] img, [data-info="product-gallery"] source').forEach(img => {
    for (const attr of ["src", "data-src"]) if (img.getAttribute(attr)) addImage(img.getAttribute(attr));
    for (const part of (img.getAttribute("srcset") || img.getAttribute("data-srcset") || "").split(/,\s*/)) if (part.trim()) addImage(part.trim().split(/\s+/)[0]);
  });
  if (!rawImages.length) addImage(meta("og:image"));
  const images = new Map();
  for (const raw of rawImages) {
    try {
      if (raw.trim().startsWith("#")) continue;
      const image = new URL(raw, location.href);
      if (image.protocol !== "https:" || image.username || image.password || image.href.length > 3000) continue;
      if (/\.svg$/i.test(image.pathname) || /\/(?:icons?|flags)\//i.test(image.pathname) || image.href === url.href) continue;
      const cdn = ["strgimgr.umico.az", "strgimgr.b-cdn.net"].includes(image.hostname);
      const width = Number(/\/img\/product\/(\d+)\//.exec(image.pathname)?.[1] || image.searchParams.get("width") || 0);
      const key = cdn ? image.pathname.replace(/\/img\/product\/\d+\//, "/img/product/") : image.href;
      if (!images.has(key) || width > images.get(key).width) images.set(key, { url: image.href, width });
    } catch { /* ignore non-URL placeholders */ }
  }
  const categories = [...document.querySelectorAll('[data-info="product-breadcrumbs-categories"] [itemprop="name"]')].map(e => clean(e.textContent)).filter(Boolean);
  const brand = clean(typeof product?.brand === "string" ? product.brand : product?.brand?.name) || specifications.find(p => /^brend$/i.test(p.name))?.value || "";
  const variantNodes = document.querySelectorAll('[data-info="product-variants"] [aria-label], [data-info="product-variants"] option');
  const sourceVariants = [...new Set([...variantNodes].map(e => clean(e.getAttribute("aria-label") || e.textContent)).filter(Boolean))].slice(0, 50);
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  let sourceUrl = url; try { const c = new URL(canonical); if (["birmarket.az", "www.birmarket.az"].includes(c.hostname) && /^\/(?:az\/|ru\/|en\/)?product\/(\d+)/.exec(c.pathname)?.[1] === id) sourceUrl = c; } catch { /* retain current product URL */ }
  sourceUrl.search = ""; sourceUrl.hash = "";
  return { name, sourceUrl: sourceUrl.href, sourceSku: String(product?.sku ?? id), brand, sourcePrice: String(offer.price ?? offer.lowPrice ?? meta("product:price:amount") ?? ""), currency: clean(offer.priceCurrency || meta("product:price:currency")), sourceCategory: categories.join(" > "), description, specifications, imageUrls: [...images.values()].slice(0, 30).map(i => i.url), sourceVariants, scrapedAt: new Date().toISOString() };
}
