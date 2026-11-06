import { describe, expect, it } from "vitest";
import plan from "../../branding/furycar/release.json";
import { brandReleaseHash, brandReleaseSchema } from "../../src/lib/brand-release";
describe("bounded owner brand release", () => {
  it("binds FuryCar and both assets to the captured store", () => {
    const parsed = brandReleaseSchema.parse(plan);
    expect(parsed.brandName).toBe("FuryCar"); expect(parsed.expected.domain).toBe("https://tema-2-staging.vercel.app"); expect(parsed.ownerMarker).toContain("catalog-presentation:");
  });
  it("rejects unrelated settings and asset traversal", () => {
    expect(brandReleaseSchema.safeParse({ ...plan, whatsapp: "+994500000000" }).success).toBe(false);
    expect(brandReleaseSchema.safeParse({ ...plan, logo: { ...plan.logo, file: "../../credentials.png" } }).success).toBe(false);
  });
  it("does not reuse a receipt for a different name or asset", () => {
    const parsed = brandReleaseSchema.parse(plan); const changed = structuredClone(parsed); changed.favicon.sha256 = "f".repeat(64);
    expect(brandReleaseHash(parsed)).not.toBe(brandReleaseHash(changed));
  });
});
