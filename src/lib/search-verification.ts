// Google ownership proof is intentionally public and scoped to this property.
export function googleSiteVerification(domain: string) {
  try {
    if (new URL(domain).origin === "https://www.furycar.shop") return "GNnIWQ3Ln3ygpUHfFGPt7nn7TqAZHplis1umi7DyZuo";
  } catch { /* An unrelated/invalid origin receives no ownership tag. */ }
  return undefined;
}
