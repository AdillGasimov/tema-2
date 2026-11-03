import { AppError } from "./errors";

export const MAX_PRODUCT_PHOTOS = 12;
const hosts = new Set(["strgimgr.umico.az", "strgimgr.b-cdn.net"]);

// Remote imports are deliberately limited to Birmarket's product-image CDNs.
// This function is also used for every redirect, before any request is sent.
export function productPhotoUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("Şəkil üçün düzgün HTTPS ünvanı yazın."); }
  if (value.length > 2048 || url.protocol !== "https:" || !hosts.has(url.hostname) || url.port || url.username || url.password ||
    !/^\/img\/product\/\d{1,5}\/[a-z0-9][a-z0-9._-]{0,180}\.(?:jpe?g|png|webp)$/i.test(url.pathname)) {
    throw new AppError("Yalnız Birmarket məhsul şəkillərinin HTTPS keçidləri qəbul edilir.");
  }
  url.hash = "";
  return url.href;
}

export function productPhotoUrls(value: string): string[] {
  const urls = [...new Set(value.split(/[|\r\n]+/).map(s => s.trim()).filter(Boolean).map(productPhotoUrl))];
  if (urls.length > MAX_PRODUCT_PHOTOS) throw new AppError(`Bir məhsulda ən çox ${MAX_PRODUCT_PHOTOS} şəkil ola bilər.`);
  return urls;
}
