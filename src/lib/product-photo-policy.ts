import { AppError } from "./errors";

export const MAX_PRODUCT_PHOTOS = 12;
const birmarketHosts = new Set(["strgimgr.umico.az", "strgimgr.b-cdn.net"]);
const temuHosts = new Set(["img.kwcdn.com", "img-1.kwcdn.com", "img-eu.kwcdn.com", "img-us.kwcdn.com"]);
const birmarketPath = /^\/img\/product\/\d{1,5}\/[a-z0-9][a-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i;
const temuPath = /^\/product\/(?:[a-z0-9_-]+\/){0,8}[a-z0-9][a-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i;

// Remote imports are limited to known suppliers' product-image CDNs.
// This function is also used for every redirect, before any request is sent.
export function productPhotoUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("Şəkil üçün düzgün HTTPS ünvanı yazın."); }
  const validPath = (birmarketHosts.has(url.hostname) && birmarketPath.test(url.pathname)) || (temuHosts.has(url.hostname) && temuPath.test(url.pathname));
  if (value.length > 2048 || url.protocol !== "https:" || !validPath || url.port || url.username || url.password) {
    throw new AppError("Yalnız Birmarket və Temu məhsul şəkillərinin HTTPS keçidləri qəbul edilir.");
  }
  url.hash = "";
  return url.href;
}

export function productPhotoProvider(value: string): "birmarket" | "temu" {
  return temuHosts.has(new URL(productPhotoUrl(value)).hostname) ? "temu" : "birmarket";
}

export function productPhotoUrls(value: string): string[] {
  const urls = [...new Set(value.split(/[|\r\n]+/).map(s => s.trim()).filter(Boolean).map(productPhotoUrl))];
  if (urls.length > MAX_PRODUCT_PHOTOS) throw new AppError(`Bir məhsulda ən çox ${MAX_PRODUCT_PHOTOS} şəkil ola bilər.`);
  return urls;
}
