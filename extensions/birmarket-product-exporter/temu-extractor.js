// Chrome serializes this function into the manually opened product tab.
// It only reads product metadata; it does not read cookies or account storage.
export function extractTemuProduct() {
  const page = new URL(location.href);
  const pathId = /(?:\/|-)g-(\d{5,20})\.html$/.exec(page.pathname)?.[1];
  const queryId = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?goods(?:\.html)?$/i.test(page.pathname) ? page.searchParams.get("goods_id") : null;
  const id = pathId || (/^\d{5,20}$/.test(queryId || "") ? queryId : null);
  if (page.protocol !== "https:" || !["temu.com", "www.temu.com"].includes(page.hostname) || page.username || page.password || page.port || !id || (pathId && page.searchParams.has("goods_id") && page.searchParams.get("goods_id") !== id)) throw new Error("Temu-da tam məhsul səhifəsini açın. Giriş tələb olunursa əvvəl hesabınıza daxil olun.");
  const clean = value => typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() : "";
  const meta = key => document.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.getAttribute("content") || "";
  const sameProduct = value => {
    if (typeof value !== "string" || value.length > 4096) return false;
    try { const u = new URL(value, page); return ["temu.com", "www.temu.com"].includes(u.hostname) && ((/(?:\/|-)g-(\d{5,20})\.html$/.exec(u.pathname)?.[1] || u.searchParams.get("goods_id")) === id); } catch { return false; }
  };
  // Read data properties only: never evaluate scripts or invoke page getters.
  const own = (object, key) => object && typeof object === "object" ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
  const structured = [], states = []; let visits = 0;
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 7 || ++visits > 1500) return;
    if (Array.isArray(value)) { value.slice(0, 150).forEach(v => walk(v, depth + 1)); return; }
    const type = own(value, "@type");
    if ((Array.isArray(type) ? type : [type]).includes("Product")) structured.push(value);
    const goodsId = own(value, "goods_id") ?? own(value, "goodsId");
    if (clean(goodsId) === id && clean(own(value, "goods_name") ?? own(value, "goodsName") ?? own(value, "name"))) states.push(value);
    for (const key of ["@graph", "mainEntity", "itemListElement", "item", "store", "data", "goods", "goodsInfo", "goods_info", "goodsDetail", "goods_detail", "goodsData", "result", "initData", "pageData", "mainData", "props", "pageProps"]) walk(own(value, key), depth + 1);
  };
  [...document.querySelectorAll('script[type="application/ld+json"],script[type="application/json"]')].slice(0, 60).forEach(script => {
    if (script.textContent.length > 1500000) return;
    try { walk(JSON.parse(script.textContent)); } catch { /* unrelated or malformed page data */ }
  });
  for (const key of ["rawData", "__INITIAL_STATE__", "__NEXT_DATA__"]) walk(own(globalThis, key));
  const product = structured.find(p => [own(p, "url"), own(p, "@id"), own(own(p, "offers"), "url")].some(v => v && sameProduct(v)) || clean(own(p, "sku")) === id) || null;
  const goods = states.sort((a, b) => Number(Array.isArray(own(b, "gallery"))) - Number(Array.isArray(own(a, "gallery"))))[0];
  const titleElement = document.querySelector('[data-testid="goods-title"],[data-testid="product-title"],[data-testid="goods-name"]');
  const h1 = titleElement || document.querySelector("h1");
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || meta("og:url");
  const matchesVisiblePhoto = value => {
    try {
      const image = new URL(value, page);
      if (image.protocol !== "https:" || !["img.kwcdn.com", "img-1.kwcdn.com", "img-eu.kwcdn.com", "img-us.kwcdn.com"].includes(image.hostname) || !image.pathname.startsWith("/product/")) return false;
      return [...document.images].some(img => { try { const visible = new URL(img.currentSrc || img.getAttribute("src"), page); return visible.hostname === image.hostname && visible.pathname === image.pathname; } catch { return false; } });
    } catch { return false; }
  };
  const domProof = !!titleElement || (meta("og:type") === "product" && sameProduct(canonical)) || (!!h1 && (matchesVisiblePhoto(page.searchParams.get("top_gallery_url")) || (sameProduct(canonical) && matchesVisiblePhoto(meta("og:image")))));
  if (!product && !goods && !domProof) throw new Error("Temu məhsulu hələ yüklənməyib. Məhsul adı və şəkillər göründükdən sonra yenidən cəhd edin; giriş tələb olunursa Temu-ya daxil olun.");
  const name = clean(own(product, "name") || own(goods, "goods_name") || own(goods, "goodsName") || own(goods, "name") || h1?.textContent);
  if (!name || /^(?:sign in|log in|register|security verification|verify you|access denied|just a moment)(?:\b|\s)/i.test(name)) throw new Error("Məhsul adı tapılmadı. Temu məhsul səhifəsinin yüklənməsini gözləyin.");
  const images = new Map();
  const addImage = value => {
    if (typeof value !== "string" || value.length > 2048) return;
    try {
      const u = new URL(value, page);
      if (u.protocol !== "https:" || u.username || u.password || u.port || !["img.kwcdn.com", "img-1.kwcdn.com", "img-eu.kwcdn.com", "img-us.kwcdn.com"].includes(u.hostname) || !/^\/product\/(?:[a-z0-9_-]+\/){0,8}[a-z0-9][a-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i.test(u.pathname)) return;
      u.hash = "";
      // Keep the original CDN URL; group transformed copies of the same image.
      const signature = `${u.hostname}${u.pathname}`;
      if (!images.has(signature) && images.size < 12) images.set(signature, u.href);
    } catch { /* not a supported product image */ }
  };
  const imageValues = value => {
    for (const item of (Array.isArray(value) ? value : [value]).slice(0, 80)) {
      if (typeof item === "string") addImage(item);
      else if (item && typeof item === "object") for (const key of ["url", "src", "imageUrl", "image_url", "thumbUrl", "thumb_url"]) addImage(own(item, key));
    }
  };
  imageValues(own(product, "image"));
  for (const key of ["gallery", "goodsGallery", "goods_gallery", "imageList", "images", "image", "thumbUrl", "thumb_url", "hdThumbUrl", "hd_thumb_url"]) imageValues(own(goods, key));
  document.querySelectorAll('[data-testid="product-gallery"] img,[data-testid="goods-gallery"] img,[data-testid="goods-detail-gallery"] img,[class*="goods-gallery"] img,[class*="goodsGallery"] img,[class*="product-gallery"] img').forEach(img => addImage(img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src")));
  if (sameProduct(canonical) || product || goods || domProof) { addImage(meta("og:image")); addImage(page.searchParams.get("top_gallery_url")); }
  if (!images.size) throw new Error("Temu məhsul şəkilləri tapılmadı. Şəkillərin yüklənməsini gözləyib yenidən cəhd edin.");
  const specifications = [], seen = new Set();
  const addSpec = (key, value) => {
    const name = clean(key).replace(/:$/, ""), content = clean(Array.isArray(value) ? value.map(clean).filter(Boolean).join(", ") : value);
    if (name && content && !seen.has(name + "\0" + content) && specifications.length < 100) { seen.add(name + "\0" + content); specifications.push({ name: name.slice(0, 200), value: content.slice(0, 1000) }); }
  };
  for (const list of [own(product, "additionalProperty"), own(goods, "properties"), own(goods, "goodsProperties"), own(goods, "goods_properties"), own(goods, "specifications")]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list.slice(0, 100)) addSpec(own(entry, "name") ?? own(entry, "propertyName") ?? own(entry, "key"), own(entry, "value") ?? own(entry, "propertyValue") ?? own(entry, "values"));
  }
  document.querySelectorAll('[data-testid="product-specifications"] tr,[data-testid="goods-specification"] tr,[id="specification"] tr').forEach(row => { const cells = row.querySelectorAll("th,td"); if (cells.length === 2) addSpec(cells[0].textContent, cells[1].textContent); });
  const offers = own(product, "offers"), offer = Array.isArray(offers) ? offers.find(o => own(o, "price") !== undefined) : offers;
  // Raw page-state numeric prices may be cents or promotional ranges. Only
  // declared structured/meta prices are captured, never converted or guessed.
  const sourcePrice = clean(own(offer, "price") ?? meta("product:price:amount") ?? "");
  const currency = clean(own(offer, "priceCurrency") || meta("product:price:currency"));
  const description = clean(own(product, "description") || document.querySelector('[data-testid="product-description"],[itemprop="description"]')?.textContent).replace(/<[^>]*>/g, "").slice(0, 10000);
  const brand = own(product, "brand") || own(goods, "brand");
  page.hash = ""; page.search = ""; if (!pathId) page.searchParams.set("goods_id", id);
  return { name: name.slice(0, 500), sourceUrl: page.href, sourceSku: clean(own(product, "sku") || id), brand: clean(typeof brand === "string" ? brand : own(brand, "name")), description,
    sourcePrice, currency, sourceCategory: clean(own(product, "category")), imageUrls: [...images.values()], specifications, sourceVariants: [], scrapedAt: new Date().toISOString() };
}
