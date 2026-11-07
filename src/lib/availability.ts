type Stock = { stock: number; reserved: number; stockVerified: boolean };
export function availability(variants: readonly Stock[]) {
  if (variants.some(v => v.stock > v.reserved && v.stockVerified)) return { className: "in-stock", label: "Stokda", schema: "https://schema.org/InStock" };
  if (variants.some(v => v.stock > v.reserved)) return { className: "stock-check", label: "Mövcudluğu dəqiqləşdirin", schema: undefined };
  return { className: "out-stock", label: "Stokda yoxdur", schema: "https://schema.org/OutOfStock" };
}
