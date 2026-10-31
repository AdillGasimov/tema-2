import { db } from "@/lib/db";
import { publicSettings } from "@/lib/settings";
import { StoreHeader, StoreFooter } from "@/components/store-shell";
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([publicSettings(), db.productCategory.findMany({ orderBy: { name: "asc" } })]);
  return <><a href="#main" className="skip-link">Məzmunu keç</a><StoreHeader settings={settings} categories={categories} /><main id="main">{children}</main><StoreFooter settings={settings} /></>;
}
