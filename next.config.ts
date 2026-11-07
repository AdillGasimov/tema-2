import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "sharp", "pg"],
  images: {
    minimumCacheTTL: 60,
    deviceSizes: [360, 480, 640, 768, 960, 1200, 1600],
    imageSizes: [32, 48, 64, 96, 128, 192, 256],
    localPatterns: [{ pathname: "/api/media/images/**", search: "?public=1" }, { pathname: "/images/storefront/**", search: "" }],
  },
  outputFileTracingIncludes: { "/*": ["./node_modules/.prisma/client/**/*"] },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
    ] }];
  },
};
export default config;
