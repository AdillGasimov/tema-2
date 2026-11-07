import { describe, expect, it } from "vitest";
import { deliveryCharge, deliveryRegionList } from "../../src/lib/delivery";
const settings = { deliveryFeeMinor: 500, freeDeliveryMinor: 0, deliveryFreeRegions: "28 May (Bakı)" };
describe("configured delivery charges", () => {
  it("charges exactly zero for the configured free destination and 5 AZN elsewhere", () => {
    expect(deliveryCharge(settings, 1500, "28 May (Bakı)")).toBe(0);
    expect(deliveryCharge(settings, 1500, "Bakı")).toBe(500);
    expect(deliveryCharge(settings, 1500, "Digər bölgələr")).toBe(500);
    expect(deliveryCharge(settings, 1500)).toBe(500);
  });
  it("normalizes case and boundary whitespace without accepting a partial destination", () => {
    expect(deliveryCharge(settings, 1500, " 28 MAY (BAKI) ")).toBe(0);
    expect(deliveryCharge(settings, 1500, "28 May (Bakı) başqa ünvan")).toBe(500);
    expect(deliveryRegionList("Bakı, , Bakı, Abşeron ")).toEqual(["Bakı", "Abşeron"]);
  });
  it("keeps an explicit positive free-delivery threshold, with zero meaning disabled", () => {
    expect(deliveryCharge(settings, 0, "Bakı")).toBe(500);
    expect(deliveryCharge({ ...settings, freeDeliveryMinor: 2000 }, 1999, "Bakı")).toBe(500);
    expect(deliveryCharge({ ...settings, freeDeliveryMinor: 2000 }, 2000, "Bakı")).toBe(0);
  });
});
