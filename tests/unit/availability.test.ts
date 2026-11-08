import { describe, expect, it } from "vitest";
import { availability } from "../../src/lib/availability";

describe("recorded stock availability", () => {
  it("shows the same in-stock label and structured data for positive available counts", () => {
    expect(availability([{ stock: 100, reserved: 0, stockVerified: false }])).toMatchObject({ className: "in-stock", label: "Stokda", schema: "https://schema.org/InStock" });
  });
  it("requires unreserved units before showing InStock", () => {
    expect(availability([{ stock: 10, reserved: 10, stockVerified: true }])).toMatchObject({ className: "out-stock", schema: "https://schema.org/OutOfStock" });
    expect(availability([{ stock: 0, reserved: 0, stockVerified: true }, { stock: 1, reserved: 0, stockVerified: true }])).toMatchObject({ className: "in-stock", schema: "https://schema.org/InStock" });
  });
});
