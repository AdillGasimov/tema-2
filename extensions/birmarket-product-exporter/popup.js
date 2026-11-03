import { captureCurrent, collection, exportFull } from "./client.js";
const status = document.querySelector("#status"), count = document.querySelector("#count");
const buttons = [...document.querySelectorAll("button")];
async function run(fn) {
  buttons.forEach(b => { b.disabled = true; }); status.textContent = "Gözləyin…"; status.className = "status";
  try { await fn(); } catch (e) { status.textContent = e.message || "Əməliyyat alınmadı."; status.className = "status error"; }
  finally { buttons.forEach(b => { b.disabled = false; }); }
}
document.querySelector("#capture").addEventListener("click", () => run(async () => {
  const saved = await captureCurrent(); count.textContent = String(saved.count);
  status.textContent = `${saved.product.name} yadda saxlanıldı. ${saved.product.imageUrls.length} şəkil linki.`;
}));
document.querySelector("#manage").addEventListener("click", () => globalThis.chrome.tabs.create({ url: globalThis.chrome.runtime.getURL("manager.html") }));
document.querySelector("#export").addEventListener("click", () => run(async () => { await exportFull(await collection()); status.textContent = "Tam CSV yükləməsi başladıldı."; }));
collection().then(products => { count.textContent = String(products.length); }).catch(e => { status.textContent = e.message; });
