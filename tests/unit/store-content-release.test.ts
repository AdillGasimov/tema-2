import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { storeContentHash, storeContentPlanSchema } from "../../src/lib/store-content-release";
const raw = JSON.parse(readFileSync("catalog/curation/2026-11-07-content.json", "utf8"));
describe("reviewed store content plan", () => {
  it("contains 22 unique short Azerbaijani URLs, translated text and the confirmed shipping policy", () => {
    const plan = storeContentPlanSchema.parse(raw);
    expect(plan.products).toHaveLength(22);
    for (const p of plan.products) {
      expect(p.after.slug.length).toBeLessThanOrEqual(60);
      expect(p.after.slug).not.toMatch(/temu-|qerb|aromat/);
      expect(p.after.description).not.toMatch(/\b(?:Windshield|Smokeless|Waterproof|Air Freshener|No Brand|Christmas)\b|aromatlaşdırıcı|aromatizator|qerb/i);
      expect(p.after.shortDescription).not.toBe("");
      expect(p.after.seoDescription!.length).toBeLessThanOrEqual(160);
    }
    expect(plan.delivery.after).toMatchObject({ deliveryFeeMinor: 500, deliveryFreeRegions: "28 May (Bakı)" });
    expect(plan.delivery.after.deliveryTime).toContain("3 iş günü"); expect(plan.delivery.after.deliveryTime).toContain("4 iş günü");
    expect(plan.products.filter(p => p.priceReview)).toHaveLength(1);
  });
  it("rejects accidental price/stock fields and duplicate destinations", () => {
    expect(() => storeContentPlanSchema.parse({ ...raw, products: [{ ...raw.products[0], after: { ...raw.products[0].after, priceMinor: 1 } }] })).toThrow();
    expect(() => storeContentPlanSchema.parse({ ...raw, products: [raw.products[0], { ...raw.products[1], after: { ...raw.products[1].after, slug: raw.products[0].after.slug } }] })).toThrow();
    const parsed = storeContentPlanSchema.parse(raw);
    expect(storeContentHash(parsed)).not.toBe(storeContentHash({ ...parsed, delivery: { ...parsed.delivery, after: { ...parsed.delivery.after, deliveryFeeMinor: 700 } } }));
  });
});
