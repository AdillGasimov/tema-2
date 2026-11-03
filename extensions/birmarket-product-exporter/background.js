import { MAX_PRODUCTS, mergeProduct, updateProduct } from "./core.js";
const api = globalThis.chrome;
let queue = Promise.resolve();
async function read() { const saved = await api.storage.local.get("products"); return Array.isArray(saved.products) ? saved.products : []; }
async function badge(products) {
  await api.action.setBadgeBackgroundColor({ color: "#c7fa60" });
  await api.action.setBadgeText({ text: products.length ? String(products.length) : "" });
}
async function handle(message) {
  if (!message || typeof message.type !== "string") throw new Error("Sorğu düzgün deyil.");
  let products = await read();
  switch (message.type) {
    case "list": return products;
    case "add": {
      if (JSON.stringify(message.product).length > 200000) throw new Error("Məhsul məlumatı çox böyükdür.");
      const normalized = mergeProduct(null, message.product); const index = products.findIndex(p => p.id === normalized.id);
      if (index < 0 && products.length >= MAX_PRODUCTS) throw new Error("200 məhsul həddinə çatdınız. CSV yükləyib kolleksiyanı təmizləyin.");
      if (index < 0) products.unshift(normalized); else products[index] = mergeProduct(products[index], message.product);
      break;
    }
    case "update": {
      if (!Array.isArray(message.changes) || message.changes.length > MAX_PRODUCTS) throw new Error("Dəyişikliklər düzgün deyil.");
      const changes = new Map(message.changes.map(c => [String(c.id), c]));
      products = products.map(p => changes.has(p.id) ? updateProduct(p, changes.get(p.id)) : p); break;
    }
    case "remove": products = products.filter(p => p.id !== String(message.id)); break;
    case "clear": products = []; break;
    default: throw new Error("Sorğu tanınmadı.");
  }
  await api.storage.local.set({ products }); await badge(products); return products;
}
api.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== api.runtime.id) return false;
  queue = queue.catch(() => {}).then(() => handle(message));
  queue.then(data => respond({ ok: true, data }), error => respond({ ok: false, error: /quota/i.test(error?.message || "") ? "Yaddaş dolub. CSV yükləyib kolleksiyanı təmizləyin." : error?.message || "Əməliyyat alınmadı." }));
  return true;
});
api.runtime.onInstalled.addListener(() => { read().then(badge).catch(() => {}); });
api.runtime.onStartup.addListener(() => { read().then(badge).catch(() => {}); });
