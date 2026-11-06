import { redirect } from "next/navigation";
import { requirePartner } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { partnerData } from "@/lib/partner";
import { getSettings } from "@/lib/settings";
import { DashboardShell } from "@/components/dashboard-shell";
import { PartnerDashboard } from "@/components/partner-dashboard";
export const metadata = { title: "Tərəfdaş kabineti", robots: { index: false, follow: false } };
export default async function PartnerPage() { let context; try { context = await requirePartner(); } catch (e) { if (e instanceof AppError) redirect("/login"); throw e; } const [data, s] = await Promise.all([partnerData(context.partner.id), getSettings()]); return <DashboardShell brandName={s.brandName} logoKey={s.logoKey} faviconKey={s.faviconKey} name={context.user.name} role="PARTNER"><PartnerDashboard data={data} /></DashboardShell>; }
