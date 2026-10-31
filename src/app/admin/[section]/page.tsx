import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAdminData } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { ProductsPanel } from "@/components/admin-products";
import { OrdersPanel } from "@/components/admin-orders";
import { PartnersPanel } from "@/components/admin-partners";
import { CommissionsPanel, ExpensesPanel, PayoutsPanel } from "@/components/admin-finance";
import { SettingsPanel } from "@/components/admin-settings";
import { AuditPanel, CategoriesPanel, CustomersPanel, DisputesPanel, IntegrationsPanel, InventoryPanel, NotificationsPanel, ReportsPanel } from "@/components/admin-misc";
import { Overview } from "@/components/dashboard-overview";
type Props<T extends (...args: never[]) => unknown> = Parameters<T>[0];
export default async function AdminSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser("ADMIN"); const { section } = await params; const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string") query.set(key, value);
  if (section === "reports") return <ReportsPanel />;
  const data = await getAdminData(section, query);
  switch (section) {
    case "overview": case "analytics": return <Overview data={data as Props<typeof Overview>["data"]} financial={section === "analytics"} />;
    case "products": return <ProductsPanel data={data as Props<typeof ProductsPanel>["data"]} />;
    case "orders": return <OrdersPanel orders={data as Props<typeof OrdersPanel>["orders"]} />;
    case "partners": case "cards": return <PartnersPanel partners={data as Props<typeof PartnersPanel>["partners"]} cards={section === "cards"} domain={(await getSettings()).domain} />;
    case "commissions": return <CommissionsPanel commissions={data as Props<typeof CommissionsPanel>["commissions"]} />;
    case "payouts": return <PayoutsPanel data={data as Props<typeof PayoutsPanel>["data"]} />;
    case "expenses": return <ExpensesPanel expenses={data as Props<typeof ExpensesPanel>["expenses"]} />;
    case "settings": return <SettingsPanel {...data as Props<typeof SettingsPanel>} />;
    case "categories": return <CategoriesPanel categories={data as Props<typeof CategoriesPanel>["categories"]} />;
    case "inventory": return <InventoryPanel data={data as Props<typeof InventoryPanel>["data"]} />;
    case "customers": return <CustomersPanel customers={data as Props<typeof CustomersPanel>["customers"]} />;
    case "disputes": return <DisputesPanel disputes={data as Props<typeof DisputesPanel>["disputes"]} />;
    case "notifications": return <NotificationsPanel notifications={data as Props<typeof NotificationsPanel>["notifications"]} />;
    case "audit": return <AuditPanel logs={data as Props<typeof AuditPanel>["logs"]} />;
    case "integrations": return <IntegrationsPanel jobs={data as Props<typeof IntegrationsPanel>["jobs"]} />;
    default: notFound();
  }
}
