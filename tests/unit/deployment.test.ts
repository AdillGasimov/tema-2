import { describe, expect, it } from "vitest";
import { appOrigin, trustedOrigins } from "../../src/lib/site";
import { shouldPrepareDeploymentDatabase } from "../../src/lib/deployment";

describe("deployment origins and database preparation", () => {
  it("uses configured origins and permits local development", () => {
    expect(appOrigin({ BETTER_AUTH_URL: "https://shop.example.test/" })).toBe("https://shop.example.test");
    expect(appOrigin({ BETTER_AUTH_URL: "http://localhost:3100" })).toBe("http://localhost:3100");
    expect(appOrigin({})).toBe("http://localhost:3000");
  });
  it("uses the platform's canonical domain and trusts only its exact deployment and branch hosts", () => {
    const env = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "store.example.test", VERCEL_URL: "store-build.example.test", VERCEL_BRANCH_URL: "store-branch.example.test" };
    expect(appOrigin(env)).toBe("https://store.example.test");
    expect(trustedOrigins(env)).toEqual(["https://store.example.test", "https://store-build.example.test", "https://store-branch.example.test"]);
    expect(trustedOrigins(env)).not.toContain("https://another-project.vercel.app");
    expect(appOrigin({ VERCEL: "1", VERCEL_URL: "store-build.example.test" })).toBe("https://store-build.example.test");
  });
  it("does not accept deployment hostnames outside the Vercel runtime", () => {
    expect(trustedOrigins({ VERCEL_URL: "untrusted.example.test" })).toEqual(["http://localhost:3000"]);
  });
  it.each(["https://user:password@example.test", "https://example.test/path", "https://example.test?redirect=evil", "http://example.test", "javascript:alert(1)"])("refuses an unsafe configured origin: %s", value => {
    expect(() => appOrigin({ BETTER_AUTH_URL: value })).toThrow();
  });
  it.each(["evil.example/path", "https://evil.example", "user@evil.example", "*.example.test"])("refuses an invalid platform hostname: %s", value => {
    expect(() => trustedOrigins({ VERCEL: "1", VERCEL_URL: value })).toThrow();
  });
  it("requires an available platform origin on Vercel instead of trusting request headers", () => {
    expect(() => appOrigin({ VERCEL: "1" })).toThrow();
  });
  it("limits automatic migrations to the Vercel primary target and supports an external release job", () => {
    expect(shouldPrepareDeploymentDatabase({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(true);
    expect(shouldPrepareDeploymentDatabase({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
    expect(shouldPrepareDeploymentDatabase({ VERCEL: "1", VERCEL_ENV: "development" })).toBe(false);
    expect(shouldPrepareDeploymentDatabase({ VERCEL_ENV: "production" })).toBe(false);
    expect(shouldPrepareDeploymentDatabase({ VERCEL: "1", VERCEL_ENV: "production", SKIP_DEPLOY_DB_SETUP: "1" })).toBe(false);
  });
});
