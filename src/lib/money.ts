export function money(minor: number) {
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${minor < 0 ? "−" : ""}${whole},${String(absolute % 100).padStart(2, "0")}\u00a0₼`;
}
export function toMinor(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim())) throw new Error("Düzgün AZN məbləği daxil edin.");
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function date(value: Date | string) {
  const p = dateParts(value);
  return `${p.day}.${p.month}.${p.year}`;
}
function dateParts(value: Date | string) { return Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(value)).map(p => [p.type, p.value])); }
export function bakuDay(value: Date | string) { const p = dateParts(value); return `${p.year}-${p.month}-${p.day}`; }
export function dateTime(value: Date | string) { return `${date(value)} ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))}`; }
export function paymentState(paid: number, refunded: number, total: number) {
  const net = paid - refunded;
  return net === 0 && refunded > 0 ? "REFUNDED" : net >= total ? "PAID" : net > 0 ? "PARTIALLY_PAID" : "UNPAID";
}
export const labels: Record<string, string> = {
  WHATSAPP_PENDING: "WhatsApp təsdiqi gözlənilir", CONFIRMED: "Təsdiqlənib", PREPARING: "Hazırlanır",
  SHIPPED: "Yoldadır", DELIVERED: "Çatdırılıb", COMPLETED: "Tamamlanıb", CANCELED: "Ləğv edilib", RETURNED: "Qaytarılıb",
  UNPAID: "Ödənilməyib", PARTIALLY_PAID: "Qismən ödənilib", PAID: "Ödənilib", REFUNDED: "Geri ödənilib",
  PENDING: "Gözləyir", APPROVED: "Təsdiqlənib", PAYABLE: "Ödənişə hazır", REVERSED: "Geri çevrilib",
  ACTIVE: "Aktiv", SUSPENDED: "Dayandırılıb", INACTIVE: "Qeyri-aktiv", DRAFT: "Qaralama", PUBLISHED: "Yayımlanıb", ARCHIVED: "Arxiv",
  OPEN: "Açıq", REJECTED: "Rədd edilib", RESOLVED: "Həll edilib", RESERVED: "Rezerv", DEDUCTED: "Stokdan çıxılıb", RELEASED: "Azad edilib", RESTORED: "Stoka qaytarılıb",
};
export const label = (value: string) => labels[value] ?? value;
