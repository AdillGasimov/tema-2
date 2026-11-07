import { describe, expect, it } from "vitest";
import { checkoutContactErrors, normalizeCheckoutPhone } from "../../src/lib/checkout-contact";
import { checkoutPhoneSchema, checkoutSchema, phoneSchema } from "../../src/lib/validation";
const valid = { name: "Əli Məmmədov", phone: "+994501234567", city: "28 May (Bakı)", address: "Bakı, sınaq küçəsi 12" };
describe("checkout contact validation", () => {
  it.each(["501234567", "0501234567", "994501234567", "+994501234567", "+994 (50) 123-45-67"])("normalizes %s without changing the subscriber number", phone => {
    expect(normalizeCheckoutPhone(phone)).toBe(valid.phone); expect(checkoutPhoneSchema.parse(phone)).toBe(valid.phone);
    expect(checkoutContactErrors({ ...valid, phone })).toEqual({});
  });
  it.each(["", "50123", "50123456789", "+9940501234567", "+491234567890", "+99450abc4567", "+994501234567#", "++994501234567", "000000000", "<script>501234567</script>"])("rejects malformed input %s on client and server", phone => {
    expect(normalizeCheckoutPhone(phone)).toBeNull(); expect(checkoutPhoneSchema.safeParse(phone).success).toBe(false);
    expect(checkoutContactErrors({ ...valid, phone })).toHaveProperty("phone");
  });
  it("accepts a nine-digit landline and preserves international admin/partner phone support", () => {
    expect(checkoutPhoneSchema.parse("124567890")).toBe("+994124567890");
    expect(phoneSchema.parse("+491234567890")).toBe("+491234567890");
  });
  it("localizes required-field errors and checks trimmed bounds", () => {
    const errors = checkoutContactErrors({ name: "  ", phone: "", city: "", address: "1234" });
    expect(Object.keys(errors)).toEqual(["name", "phone", "city", "address"]);
    expect(errors.name).toContain("Ad və soyadı"); expect(errors.address).toContain("ünvan");
    expect(checkoutContactErrors({ ...valid, name: "x".repeat(101), address: "x".repeat(501) })).toHaveProperty("name");
  });
  it("produces the same normalized checkout payload for equivalent accepted formats", () => {
    const input = { ...valid, idempotencyKey: "00000000-0000-4000-8000-000000000001", items: [{ variantId: "test", quantity: 1 }] };
    expect(JSON.stringify(checkoutSchema.parse({ ...input, phone: "0501234567" }))).toBe(JSON.stringify(checkoutSchema.parse(input)));
    expect(checkoutSchema.safeParse({ ...input, phone: null }).success).toBe(false);
  });
});
