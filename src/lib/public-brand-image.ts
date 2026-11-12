import { publicImageSrc } from "./public-image";

type BrandImage = { url: string; type: "image/png" | "image/webp"; width?: number; height?: number };
// Public, unchanged copies of this owner's approved artwork. Match the stored
// image identity so a later administrator logo/icon change takes effect normally.
const published: Readonly<Record<string, BrandImage>> = {
  "images/69af2cfc-0e4e-47dd-9c6f-bbb3835abb25.webp": { url: "/branding/furycar/favicon.png", type: "image/png", width: 1254, height: 1254 },
  "images/b16857c9-198a-4ea2-9bfd-44a29e0a4732.webp": { url: "/branding/furycar/logo.png", type: "image/png", width: 2172, height: 724 },
};
export function publicBrandImage(key: string | null | undefined): BrandImage | null {
  return key ? published[key] ?? { url: publicImageSrc(key), type: "image/webp" } : null;
}
