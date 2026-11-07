import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { productAliasTarget } from "../../src/lib/product-routing";
import { proxy } from "../../src/proxy";
vi.mock("../../src/lib/product-routing", () => ({ productAliasTarget: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
describe("product routing without an extra HTTP hop", () => {
  it("does not fetch the fallback for a successful canonical lookup", async () => {
    vi.mocked(productAliasTarget).mockResolvedValue(null);
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await proxy(new NextRequest("https://store.example/products/canonical"));
    expect(result.headers.get("x-middleware-next")).toBe("1");
    expect(result.headers.get("server-timing")).toContain('desc="direct"');
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the existing Node route as fallback and preserves a genuine 301 plus query", async () => {
    vi.mocked(productAliasTarget).mockRejectedValue(new Error("Direct driver unavailable"));
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ slug: "current" }));
    const result = await proxy(new NextRequest("https://store.example/products/old?ref=ADIL01&x=1"));
    expect(result.status).toBe(301); expect(result.headers.get("location")).toBe("https://store.example/products/current?ref=ADIL01&x=1");
    expect(result.headers.get("server-timing")).toContain('desc="fallback"');
    expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe("/api/catalog/redirect");
  });
  it("keeps canonical pages accessible if both routing lookups fail", async () => {
    vi.mocked(productAliasTarget).mockRejectedValue(new Error("Direct unavailable"));
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Fallback unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await proxy(new NextRequest("https://store.example/products/current"))).headers.get("x-middleware-next")).toBe("1");
  });
});
