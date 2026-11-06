import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DashboardShell } from "@/components/dashboard-shell";
import { AppError } from "@/lib/errors";
export const metadata = { title: "İdarəetmə", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) { let user; try { user = await requireUser("ADMIN"); } catch (e) { if (e instanceof AppError) redirect("/login"); throw e; } const s = await getSettings(); return <DashboardShell brandName={s.brandName} logoKey={s.logoKey} faviconKey={s.faviconKey} name={user.name} role="ADMIN">{children}</DashboardShell>; }
