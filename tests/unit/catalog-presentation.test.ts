import { describe, expect, it } from "vitest";
import plan from "../../catalog/curation/2026-11-06.json";
import { catalogPresentationHash, catalogPresentationSchema } from "../../src/lib/catalog-presentation";

describe("bounded owner catalog presentation", () => {
  it("validates all 18 captured products and their cover source identities", () => {
    const parsed = catalogPresentationSchema.parse(plan);
    expect(parsed.items).toHaveLength(18);
    expect(parsed.items.filter(i => i.coverAsset)).toHaveLength(4);
    expect(new Set(parsed.items.map(i => i.id)).size).toBe(18);
  });
  it("rejects financial fields, duplicate products and covers outside the captured gallery", () => {
    expect(catalogPresentationSchema.safeParse({ ...plan, items: [{ ...plan.items[0], priceMinor: 1 }] }).success).toBe(false);
    expect(catalogPresentationSchema.safeParse({ ...plan, items: [plan.items[0], plan.items[0]] }).success).toBe(false);
    expect(catalogPresentationSchema.safeParse({ ...plan, items: [{ ...plan.items[0], coverKey: "images/00000000-0000-4000-8000-000000000000.webp" }] }).success).toBe(false);
  });
  it("rejects asset traversal and missing category definitions", () => {
    expect(catalogPresentationSchema.safeParse({ ...plan, items: [{ ...plan.items[0], coverAsset: { ...plan.items[0].coverAsset, file: "../../secret.png" } }] }).success).toBe(false);
    expect(catalogPresentationSchema.safeParse({ ...plan, categories: plan.categories.slice(1) }).success).toBe(false);
  });
  it("binds the receipt to the actual names, categories and asset bytes", () => {
    const parsed = catalogPresentationSchema.parse(plan);
    const changed = structuredClone(parsed); changed.items[0].name += " dəyişiklik";
    expect(catalogPresentationHash(parsed)).not.toBe(catalogPresentationHash(changed));
  });
});
