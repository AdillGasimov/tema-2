import { productId, productSource, fullCsv, storeCsvBatches } from "./core.js";
import { extractBirmarketProduct } from "./extractor.js";
import { extractTemuProduct } from "./temu-extractor.js";
const api = globalThis.chrome;
export async function collection(type = "list", fields = {}) {
  const result = await api.runtime.sendMessage({ type, ...fields });
  if (!result?.ok) throw new Error(result?.error || "Əlavə cavab vermədi. Yenidən açın.");
  return result.data;
}
export async function captureTab(tabId) {
  const tab = await api.tabs.get(tabId);
  const source = productSource(tab.url);
  if (!source) throw new Error("Əvvəl Birmarket və ya Temu məhsul səhifəsini açın.");
  const result = await api.scripting.executeScript({ target: { tabId }, func: source.marketplace === "temu" ? extractTemuProduct : extractBirmarketProduct, ...(source.marketplace === "temu" ? { world: "MAIN" } : {}) });
  const product = result[0]?.result;
  if (!product || productId(product.sourceUrl) !== source.id) throw new Error("Məhsul oxunmadı. Səhifənin yüklənməsini gözləyin.");
  const products = await collection("add", { product });
  return { product: products.find(p => p.id === productId(product.sourceUrl)), count: products.length };
}
export async function captureCurrent() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Aktiv səhifə tapılmadı.");
  return captureTab(tab.id);
}
function day() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
async function download(content, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  try { await api.downloads.download({ url, filename, saveAs: false }); }
  catch (error) { URL.revokeObjectURL(url); throw error; }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function exportFull(products) {
  if (!products.length) throw new Error("Əvvəl məhsul yadda saxlayın.");
  await download(fullCsv(products), `products-full-${day()}.csv`);
}
export async function exportStore(products) {
  const files = storeCsvBatches(products);
  for (let i = 0; i < files.length; i++) await download(files[i], `products-store-${day()}-${String(i + 1).padStart(2, "0")}.csv`);
  return files.length;
}
