import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/lib/errors";
import { readReferral, signReferral } from "../../src/lib/referrals";

const authKey = "auth-only-test-key-for-referral-fallback-123456789";
const dedicatedKey = "dedicated-referral-test-key-1234567890123456789";
afterEach(() => vi.unstubAllEnvs());

describe("referral signing configuration", () => {
  it("preserves dedicated-key cookies independently of auth-key rotation", () => {
    vi.stubEnv("REFERRAL_SECRET", dedicatedKey);
    vi.stubEnv("BETTER_AUTH_SECRET", authKey);
    const token = signReferral("ADIL01", 2000);
    vi.stubEnv("BETTER_AUTH_SECRET", `${authKey}-rotated`);
    expect(readReferral(token, 1000)).toBe("ADIL01");
  });

  it("uses a stable, separate signing key when only the auth secret is configured", () => {
    vi.stubEnv("REFERRAL_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", authKey);
    const token = signReferral("ADIL01", 2000);
    expect(readReferral(token, 1000)).toBe("ADIL01");
    vi.stubEnv("REFERRAL_SECRET", authKey);
    expect(readReferral(token, 1000)).toBeNull();
    vi.stubEnv("REFERRAL_SECRET", undefined);
    expect(readReferral(token, 1000)).toBe("ADIL01");
  });

  it("also supports an empty optional referral secret", () => {
    vi.stubEnv("REFERRAL_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", authKey);
    expect(readReferral(signReferral("ADIL01", 2000), 1000)).toBe("ADIL01");
  });

  it("rejects expired and tampered fallback cookies", () => {
    vi.stubEnv("REFERRAL_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", authKey);
    const token = signReferral("ADIL01", 2000);
    expect(readReferral(token, 2000)).toBeNull();
    const [payload, signature] = token.split(".");
    const changed = Buffer.from(JSON.stringify({ code: "OTHER01", expiresAt: 2000 })).toString("base64url");
    expect(readReferral(`${changed}.${signature}`, 1000)).toBeNull();
    expect(readReferral(`${payload}.${signature}x`, 1000)).toBeNull();
  });

  it("invalidates fallback cookies after the auth secret rotates", () => {
    vi.stubEnv("REFERRAL_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", authKey);
    const token = signReferral("ADIL01", 2000);
    vi.stubEnv("BETTER_AUTH_SECRET", `${authKey}-rotated`);
    expect(readReferral(token, 1000)).toBeNull();
  });

  it.each([undefined, "", "short", " ".repeat(40)])("fails closed without a usable signing secret (%s)", authSecret => {
    vi.stubEnv("REFERRAL_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_SECRET", authSecret);
    expect(() => signReferral("ADIL01", 2000)).toThrow(AppError);
    expect(readReferral("untrusted.data", 1000)).toBeNull();
  });
});
