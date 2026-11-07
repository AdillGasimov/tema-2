import { describe, expect, it } from "vitest";
import { availability } from "../../src/lib/availability";

describe("honest stock availability", () => {
  it("does not claim in-stock structured data from an unverified positive CSV count", () => {
    expect(availability([{ stock: 100, reserved: 0, stockVerified: false }])).toMatchObject({ className: "stock-check", schema: undefined });
  });
  it("requires verified and unreserved units before showing InStock", () => {
    expect(availability([{ stock: 10, reserved: 10, stockVerified: true }])).toMatchObject({ className: "out-stock", schema: "https://schema.org/OutOfStock" });
    expect(availability([{ stock: 0, reserved: 0, stockVerified: true }, { stock: 1, reserved: 0, stockVerified: true }])).toMatchObject({ className: "in-stock", schema: "https://schema.org/InStock" });
  });
});
