import { collection, exportFull, exportStore } from "./client.js";
import { storeDescription } from "./core.js";
const list = document.querySelector("#products"), status = document.querySelector("#status");
let products = [], dirty = false;
const element = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
function render() {
  list.replaceChildren(); document.querySelector("#count").textContent = `${products.length} məhsul`;
  document.querySelector("#empty").hidden = !!products.length;
  for (const product of products) {
    const card = element("section", undefined, "product"); card.dataset.id = product.id;
    const heading = element("div", undefined, "product-heading"); const title = element("h2", product.name);
    const remove = element("button", "Sil", "danger small"); remove.type = "button";
    remove.addEventListener("click", () => run(async () => { await save(); products = await collection("remove", { id: product.id }); render(); status.textContent = "Məhsul kolleksiyadan silindi."; }));
    heading.append(title, remove); card.append(heading);
    const summary = element("p", `Mənbə: ${product.sourcePrice || "qiymət tapılmadı"} ${product.currency} · ${product.imageUrls.length} şəkil · ${product.brand || "Brend göstərilməyib"}`, "source"); card.append(summary);
    const fields = element("div", undefined, "fields");
    const labels = { storeName: "Mağazada məhsul adı", sku: "Mağaza SKU", price: "Satış AZN", cost: "Maya AZN", stock: "Stok", category: "Mağaza kateqoriyası", variant: "Variant", slug: "URL adı (istəyə bağlı)", discount: "Endirim AZN (istəyə bağlı)" };
    for (const [key, label] of Object.entries(labels)) {
      const field = element("label", label); const input = document.createElement("input");
      input.name = key; input.value = product[key] || ""; input.setAttribute("aria-label", `${label} · ${product.id}`);
      if (["price", "cost", "stock", "discount"].includes(key)) input.inputMode = key === "stock" ? "numeric" : "decimal";
      if (key === "category") input.placeholder = "Mağazadakı kateqoriya adı və ya URL adı";
      input.addEventListener("input", () => { dirty = true; }); field.append(input); fields.append(field);
    }
    const descriptionLabel = element("label", "Mağazada təsvir"); const description = document.createElement("textarea");
    description.name = "descriptionOverride"; description.value = storeDescription(product); description.maxLength = 10000; description.rows = 5;
    description.setAttribute("aria-label", `Mağazada təsvir · ${product.id}`); description.addEventListener("input", () => { dirty = true; }); descriptionLabel.append(description);
    card.append(fields, descriptionLabel);
    const details = document.createElement("details"); details.append(element("summary", "Mənbə detalları və şəkil linkləri"));
    const source = element("a", "Mənbə məhsul səhifəsini aç"); source.href = product.sourceUrl; source.target = "_blank"; source.rel = "noopener noreferrer"; details.append(source);
    if (product.sourceCategory) details.append(element("p", product.sourceCategory));
    if (product.description) details.append(element("p", product.description));
    const specs = element("ul"); for (const spec of product.specifications) specs.append(element("li", `${spec.name}: ${spec.value}`)); details.append(specs);
    for (const url of product.imageUrls) { const link = element("a", url); link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.className = "image-link"; details.append(link); }
    if (!product.imageUrls.length) details.append(element("p", "Şəkil linki tapılmadı; məhsul səhifəsini yeniləyib yenidən yadda saxlayın.", "error"));
    card.append(details); list.append(card);
  }
  dirty = false;
}
async function save() {
  const changes = [...list.querySelectorAll(".product")].map(card => ({ id: card.dataset.id, ...Object.fromEntries([...card.querySelectorAll("input,textarea")].map(input => [input.name, input.value])) }));
  products = await collection("update", { changes }); dirty = false;
}
async function run(fn) {
  const buttons = [...document.querySelectorAll("button")]; buttons.forEach(b => { b.disabled = true; });
  status.textContent = "Gözləyin…"; status.className = "status";
  try { await fn(); } catch (e) { status.textContent = e.message || "Əməliyyat alınmadı."; status.className = "status error"; }
  finally { [...document.querySelectorAll("button")].forEach(b => { b.disabled = false; }); }
}
document.querySelector("#save").addEventListener("click", () => run(async () => { await save(); status.textContent = "Dəyişikliklər yadda saxlanıldı."; }));
document.querySelector("#export-full").addEventListener("click", () => run(async () => { await save(); await exportFull(products); status.textContent = "Tam CSV yükləməsi başladıldı. Şəkil linkləri fayldadır."; }));
document.querySelector("#export-store").addEventListener("click", () => run(async () => { await save(); const count = await exportStore(products); status.textContent = `${count} mağaza CSV faylının yükləməsi başladıldı. Şəkillər üçün tam CSV-ni də saxlayın.`; }));
document.querySelector("#refresh").addEventListener("click", () => run(async () => { await save(); products = await collection(); render(); status.textContent = "Kolleksiya yeniləndi."; }));
document.querySelector("#clear").addEventListener("click", () => {
  if (confirm("Kolleksiyadakı məhsullar silinsin? Əvvəl CSV faylınızı yüklədiyinizə əmin olun.")) run(async () => { products = await collection("clear"); render(); status.textContent = "Kolleksiya təmizləndi."; });
});
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
run(async () => { products = await collection(); render(); status.textContent = "Məhsulları yoxlayın. Mənbə qiyməti sizin satış qiymətiniz və ya maya dəyəriniz kimi avtomatik qəbul edilmir."; });
