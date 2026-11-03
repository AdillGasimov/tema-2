import { afterEach, describe, expect, it, vi } from "vitest";
import { productPhotoUrl, productPhotoUrls } from "../../src/lib/product-photo-policy";
import { downloadProductPhoto } from "../../src/lib/product-photo-download";
import { MAX_IMAGE_BYTES } from "../../src/lib/image-policy";
import { readJsonBody } from "../../src/lib/json-body";
const url = "https://strgimgr.umico.az/img/product/1680/test.jpeg";
afterEach(() => vi.unstubAllGlobals());

describe("remote product photo policy and bounded downloads", () => {
  it("accepts only product photos on the two known HTTPS CDNs and normalizes fragments", () => {
    expect(productPhotoUrl(`${url}?width=800#ignored`)).toBe(`${url}?width=800`);
    expect(productPhotoUrl(url.replace("umico.az", "b-cdn.net"))).toContain("b-cdn.net");
    expect(productPhotoUrls(`${url} | ${url}\n${url}#a`)).toEqual([url]);
    for (const value of ["http://strgimgr.umico.az/img/product/1680/test.jpeg", "https://127.0.0.1/img/product/1/a.jpg", "https://[::1]/img/product/1/a.jpg", "https://strgimgr.umico.az.evil.test/img/product/1/a.jpg", url.replace("https://", "https://user:pass@"), url.replace(".az/", ".az:8443/"), url.replace("test.jpeg", "test.svg"), url.replace("/img/product/", "/icons/")]) expect(() => productPhotoUrl(value)).toThrow();
    expect(() => productPhotoUrls(Array.from({ length: 13 }, (_, n) => url.replace("test", `photo${n}`)).join(" | "))).toThrow("12 şəkil");
  });
  it("copies bytes without cookies or auth and disables automatic redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })); vi.stubGlobal("fetch", fetcher);
    const file = await downloadProductPhoto(url);
    expect(file.type).toBe("image/jpeg"); expect([...new Uint8Array(await file.arrayBuffer())]).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "manual", credentials: "omit", cache: "no-store", signal: expect.any(AbortSignal), headers: { Accept: "image/jpeg,image/png,image/webp" } }));
  });
  it("follows approved redirects but refuses an internal destination before requesting it", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: url.replace("umico.az", "b-cdn.net") } })).mockResolvedValueOnce(new Response("image", { headers: { "content-type": "image/webp" } })); vi.stubGlobal("fetch", fetcher);
    expect((await downloadProductPhoto(url)).type).toBe("image/webp"); expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/img/product/1/a.jpg" } }));
    await expect(downloadProductPhoto(url)).rejects.toThrow("Yalnız Birmarket"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds redirect loops and hides upstream errors", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 302, headers: { location: url } }))); vi.stubGlobal("fetch", fetcher);
    await expect(downloadProductPhoto(url)).rejects.toThrow("yönləndirmə"); expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockRejectedValue(new Error("upstream secret details"));
    await expect(downloadProductPhoto(url)).rejects.toMatchObject({ status: 502, message: "Şəkil mənbəyi ilə bağlantı alınmadı. Yenidən cəhd edin." });
  });
  it("rejects a declared large image and bounds streamed bytes even when length is false or absent", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    fetcher.mockResolvedValue(new Response("small", { headers: { "content-type": "image/png", "content-length": String(MAX_IMAGE_BYTES + 1) } }));
    await expect(downloadProductPhoto(url)).rejects.toMatchObject({ status: 413 });
    for (const length of [undefined, "1"]) {
      const headers: Record<string, string> = { "content-type": "image/png" }; if (length) headers["content-length"] = length;
      fetcher.mockResolvedValue(new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), { headers }));
      await expect(downloadProductPhoto(url)).rejects.toMatchObject({ status: 413 });
    }
  });
  it("refuses HTML, failed status and empty images", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const response of [new Response("html", { headers: { "content-type": "text/html" } }), new Response("error", { status: 403, headers: { "content-type": "image/jpeg" } }), new Response("", { headers: { "content-type": "image/png" } })]) {
      fetcher.mockResolvedValue(response); await expect(downloadProductPhoto(url)).rejects.toMatchObject({ status: 422 });
    }
  });
});
describe("bounded import JSON", () => {
  it("reads UTF-8 JSON and bounds actual bodies regardless of their declared size", async () => {
    const req = (body: string, length?: string) => new Request("https://shop.test/", { method: "POST", headers: length ? { "content-length": length } : undefined, body });
    expect(await readJsonBody(req('{"sku":"dəsmal"}'), 100)).toEqual({ sku: "dəsmal" });
    for (const length of [undefined, "1", "1000"]) await expect(readJsonBody(req("x".repeat(101), length), 100)).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(req("not-json"), 100)).rejects.toThrow("JSON");
  });
});
