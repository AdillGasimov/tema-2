type DeliverySettings = { deliveryFeeMinor: number; freeDeliveryMinor: number; deliveryFreeRegions?: string };
export const deliveryRegionList = (value: string) => [...new Set(value.split(",").map(v => v.trim()).filter(Boolean))];
export function freeDeliveryMessage(value: string) {
  const regions = deliveryRegionList(value);
  return regions.length ? `${regions.join(", ")} üçün çatdırılma ödənişsizdir.` : null;
}
export function deliveryCharge(settings: DeliverySettings, subtotalMinor: number, city = "") {
  if (settings.freeDeliveryMinor > 0 && subtotalMinor >= settings.freeDeliveryMinor) return 0;
  const selected = city.trim().toLocaleLowerCase("az");
  if (selected && deliveryRegionList(settings.deliveryFreeRegions ?? "").some(v => v.toLocaleLowerCase("az") === selected)) return 0;
  return settings.deliveryFeeMinor;
}
