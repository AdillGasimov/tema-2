import { describe, it, expect } from "vitest";
import { toMinor, paymentState, money, date, bakuDay } from "../../src/lib/money";
import { csv } from "../../src/lib/csv";
import { readReferral, signReferral } from "../../src/lib/referrals";
import { checkoutSchema, codeSchema, productSchema } from "../../src/lib/validation";
describe("money and input invariants", () => {
  it.each([["0.01", 1], ["12.50", 1250], ["24", 2400], ["2,99", 299]])("parses %s exactly into minor units", (s, n) => expect(toMinor(s)).toBe(n));
  it.each(["-1", "1.001", "1e3", "NaN", "Infinity", ""]) ("rejects malformed money %s", s => expect(() => toMinor(s)).toThrow());
  it("distinguishes collected, partial and refunded payments", () => { expect(paymentState(0, 0, 1500)).toBe("UNPAID"); expect(paymentState(100, 0, 1500)).toBe("PARTIALLY_PAID"); expect(paymentState(1500, 0, 1500)).toBe("PAID"); expect(paymentState(1500, 1500, 1500)).toBe("REFUNDED"); });
  it("normalizes codes and refuses unsafe values", () => { expect(codeSchema.parse(" ali01 ")).toBe("ALI01"); expect(codeSchema.safeParse("<script>").success).toBe(false); });
  it("formats money and Baku dates deterministically across server and browser", () => { expect(money(1500)).toBe("15,00\u00a0₼"); expect(money(-201)).toBe("−2,01\u00a0₼"); expect(date("2026-10-31T22:30:00Z")).toBe("01.11.2026"); expect(bakuDay("2026-10-31T22:30:00Z")).toBe("2026-11-01"); });
  it("rejects public checkout price injection and malformed requests", () => { expect(checkoutSchema.safeParse({ priceMinor: 1 }).success).toBe(false); expect(productSchema.safeParse({ name: "x" }).success).toBe(false); });
  it("escapes CSV cells and spreadsheet formulas", () => { const result = csv([["=1+1", "+994500000000", 'a,"b', -200]]); expect(result).toContain("'=1+1"); expect(result).toContain("'+994"); expect(result).toContain('"a,""b"'); expect(result).toContain('"-200"'); });
});
describe("referral signatures", () => {
  it("reads a valid referral and rejects expiry", () => { const token = signReferral("ALI01", 2000); expect(readReferral(token, 1000)).toBe("ALI01"); expect(readReferral(token, 2000)).toBeNull(); });
  it("rejects tampering, corrupt data and direct visits", () => { const token = signReferral("ALI01", Date.now() + 30000); expect(readReferral(token + "x")).toBeNull(); expect(readReferral("untrusted.data")).toBeNull(); expect(readReferral()).toBeNull(); });
});
