import { storefrontCategories } from "@/lib/catalog";
import { publicSettings } from "@/lib/settings";
import { StoreHeader, StoreFooter } from "@/components/store-shell";
import "../storefront.css";
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([publicSettings(), storefrontCategories()]);
  return <div className="storefront"><a href="#main" className="skip-link">Məzmunu keç</a><StoreHeader settings={settings} categories={categories} /><main id="main">{children}</main><StoreFooter settings={settings} /></div>;
}
