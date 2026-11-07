import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "../../src/components/brand-logo";
const logoKey = "images/00000000-0000-4000-8000-000000000001.webp";
const faviconKey = "images/00000000-0000-4000-8000-000000000002.webp";
describe("database-driven brand lockups", () => {
  it("uses the approved full logo on light surfaces", () => {
    const html = decodeURIComponent(renderToStaticMarkup(<BrandLogo brandName="FuryCar" logoKey={logoKey} faviconKey={faviconKey} />));
    expect(html).toContain(`/_next/image?url=/api/media/${logoKey}?public=1`); expect(html).toContain('alt="FuryCar"'); expect(html).not.toContain(`/api/media/${faviconKey}`);
  });
  it("uses the matching symbol and readable name on dark surfaces", () => {
    const html = decodeURIComponent(renderToStaticMarkup(<BrandLogo brandName="FuryCar" logoKey={logoKey} faviconKey={faviconKey} dark />));
    expect(html).toContain(`/_next/image?url=/api/media/${faviconKey}?public=1`); expect(html).toContain("brand-wordmark-custom"); expect(html).toContain("FuryCar"); expect(html).not.toContain(`/api/media/${logoKey}`);
  });
  it("backs logos without a separate symbol with a light panel on dark surfaces", () => {
    const html = renderToStaticMarkup(<BrandLogo brandName="Owner store" logoKey={logoKey} dark />);
    expect(html).toContain("brand-logo-light-panel"); expect(html).toContain('alt="Owner store"');
  });
  it("keeps the existing fallback and edited store names", () => {
    const html = renderToStaticMarkup(<BrandLogo brandName="Another owner brand" />);
    expect(html).toContain("brand-mark"); expect(html).toContain("Another owner brand"); expect(html).not.toContain("FuryCar");
  });
});
