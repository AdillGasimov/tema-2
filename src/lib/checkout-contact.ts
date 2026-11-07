export const checkoutContactMessages = {
  name: "Ad və soyadı daxil edin (2–100 simvol).",
  phone: "Düzgün Azərbaycan nömrəsi yazın: +994 və 9 rəqəm. Məsələn: +994501234567.",
  phoneCharacters: "Yalnız rəqəmlər yazın. Məsələn: 501234567.",
  city: "Çatdırılma bölgəsini seçin.",
  address: "Çatdırılma ünvanını tam yazın (5–500 simvol).",
  consent: "Davam etmək üçün məxfilik siyasəti ilə tanış olduğunuzu təsdiqləyin.",
} as const;
export type CheckoutContact = { name: string; phone: string; city: string; address: string };
export type CheckoutField = keyof CheckoutContact | "consent";
export type CheckoutFieldErrors = Partial<Record<CheckoutField, string>>;

// Normalize recognized phone formatting only; never remove letters or arbitrary
// punctuation to turn a malformed number into a different valid number.
export function normalizeCheckoutPhone(value: string): string | null {
  if (value.length > 40 || !/^[+0-9\s()-]+$/.test(value)) return null;
  const phone = value.replace(/[\s()-]/g, "");
  if (/^\+994[1-9][0-9]{8}$/.test(phone)) return phone;
  if (/^994[1-9][0-9]{8}$/.test(phone)) return `+${phone}`;
  if (/^0[1-9][0-9]{8}$/.test(phone)) return `+994${phone.slice(1)}`;
  if (/^[1-9][0-9]{8}$/.test(phone)) return `+994${phone}`;
  return null;
}
export function checkoutContactErrors(value: CheckoutContact): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  if (value.name.trim().length < 2 || value.name.trim().length > 100) errors.name = checkoutContactMessages.name;
  if (!normalizeCheckoutPhone(value.phone)) errors.phone = checkoutContactMessages.phone;
  if (value.city.trim().length < 2 || value.city.trim().length > 100) errors.city = checkoutContactMessages.city;
  if (value.address.trim().length < 5 || value.address.trim().length > 500) errors.address = checkoutContactMessages.address;
  return errors;
}
