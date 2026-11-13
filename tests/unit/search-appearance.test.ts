import { describe, expect, it } from "vitest";
import { homeSearchCopy, homeSiteStructuredData, serializeJsonLd, storeIdentityDescription } from "../../src/lib/search-appearance";
import { publicBrandImage } from "../../src/lib/public-brand-image";
import { googleSiteVerification } from "../../src/lib/search-verification";

const brand = { brandName: "FuryCar", domain: "https://www.furycar.shop", logoKey: "images/b16857c9-198a-4ea2-9bfd-44a29e0a4732.webp", faviconKey: "images/69af2cfc-0e4e-47dd-9c6f-bbb3835abb25.webp", instagram: "", tiktok: "" };
describe("search result branding", () => {
  it("identifies the actual shop consistently in visible copy and structured descriptions", () => {
    const description = storeIdentityDescription(brand.brandName);
    expect(description).toContain("FuryCar — avtomobil aksesuarları üzrə onlayn mağaza.");
    expect(homeSiteStructuredData(brand)["@graph"].every(node => node.description === description)).toBe(true);
    expect(storeIdentityDescription("Başqa mağaza")).toContain("Başqa mağaza —");
  });
  it("includes the owner-provided verification tag only for its exact HTTPS property", () => {
    expect(googleSiteVerification(brand.domain)).toBe("GNnIWQ3Ln3ygpUHfFGPt7nn7TqAZHplis1umi7DyZuo");
    for (const domain of ["https://other.example", "https://www.furycar.shop.example", "http://www.furycar.shop", "http://localhost:3100", "invalid"]) expect(googleSiteVerification(domain)).toBeUndefined();
  });
  it("uses the configured name and actual free-delivery offer in concise Azerbaijani copy", () => {
    const copy = homeSearchCopy({ ...brand, deliveryFreeRegions: "28 May (Bakı)" });
    expect(copy.title).toBe("FuryCar | Avtomobil aksesuarları və ətirləndiricilər");
    expect(copy.description).toContain("28 May (Bakı) üçün çatdırılma ödənişsizdir.");
    expect(copy.description).toContain("WhatsApp ilə rahat sifariş.");
    expect(copy.description.length).toBeLessThanOrEqual(160);
    expect(homeSearchCopy({ brandName: "Başqa mağaza", deliveryFreeRegions: "" })).toMatchObject({ title: "Başqa mağaza | Avtomobil aksesuarları və ətirləndiricilər" });
    expect(homeSearchCopy({ ...brand, deliveryFreeRegions: "" }).description).not.toContain("ödənişsiz");
  });
  it("links the website and organization with the configured canonical domain and approved logo", () => {
    const data = homeSiteStructuredData(brand), [organization, website] = data["@graph"];
    expect(organization).toMatchObject({ "@type": "Organization", "@id": "https://www.furycar.shop/#organization", name: "FuryCar", url: "https://www.furycar.shop/", logo: { url: "https://www.furycar.shop/branding/furycar/logo.png", width: 2172, height: 724 } });
    expect(website).toMatchObject({ "@type": "WebSite", name: "FuryCar", inLanguage: "az-AZ", publisher: { "@id": organization["@id"] } });
    expect(organization).not.toHaveProperty("sameAs");
    expect(organization).not.toHaveProperty("address");
    expect(website).not.toHaveProperty("potentialAction");
  });
  it("uses only configured HTTPS social profiles and does not fabricate reviews or legal identity", () => {
    const data = homeSiteStructuredData({ ...brand, instagram: "https://www.instagram.com/furycar", tiktok: "javascript:alert(1)" });
    expect(data["@graph"][0]).toMatchObject({ sameAs: ["https://www.instagram.com/furycar"] });
    expect(JSON.stringify(data)).not.toMatch(/aggregateRating|taxID|review/);
  });
  it("preserves later rebranding and custom image changes without keeping the FuryCar graphic", () => {
    const changed = { ...brand, brandName: "Digər mağaza", domain: "https://other.example", logoKey: "images/00000000-0000-4000-8000-000000000001.webp", faviconKey: null };
    const data = homeSiteStructuredData(changed);
    expect(data["@graph"][0]).toMatchObject({ name: changed.brandName, url: "https://other.example/", logo: { url: `https://other.example/api/media/${changed.logoKey}?public=1` } });
    expect(JSON.stringify(data)).not.toContain("furycar");
    expect(publicBrandImage(changed.logoKey)).not.toHaveProperty("width");
    expect(publicBrandImage(null)).toBeNull();
  });
  it("advertises the real square PNG dimensions for the configured approved favicon", () => {
    expect(publicBrandImage(brand.faviconKey)).toEqual({ url: "/branding/furycar/favicon.png", type: "image/png", width: 1254, height: 1254 });
  });
  it("safely embeds stored text containing closing scripts and Unicode separators without changing the data", () => {
    const input = homeSiteStructuredData({ ...brand, brandName: "Mağaza </script><script>alert(1)</script>\u2028\u2029" });
    const text = serializeJsonLd(input);
    expect(text).not.toContain("<"); expect(text).not.toContain("\u2028"); expect(text).not.toContain("\u2029");
    expect(JSON.parse(text)).toEqual(input);
  });
});
