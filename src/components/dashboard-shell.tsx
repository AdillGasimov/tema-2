"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { LayoutDashboard, Package, Layers, Warehouse, ShoppingBag, Users, ScanLine, Wallet, ChartNoAxesCombined, Receipt, FileDown, Settings2, MessagesSquare, Bell, History, RefreshCw, LogOut, ArrowUpRight, Sparkles, Handshake, CreditCard, Menu } from "lucide-react";
import { useState } from "react";
export const adminNav = [
  ["overview", "İcmal", LayoutDashboard], ["products", "Məhsullar", Package], ["categories", "Kateqoriyalar", Layers], ["inventory", "Anbar", Warehouse],
  ["orders", "Sifarişlər", ShoppingBag], ["customers", "Müştərilər", Users], ["partners", "Tərəfdaşlar və kodlar", Handshake], ["cards", "QR kartlar", ScanLine],
  ["commissions", "Komissiyalar", Wallet], ["payouts", "Ödənişlər", CreditCard], ["analytics", "Analitika", ChartNoAxesCombined], ["expenses", "Xərclər", Receipt],
  ["reports", "Hesabatlar", FileDown], ["disputes", "Müraciətlər", MessagesSquare], ["notifications", "Bildirişlər", Bell], ["integrations", "İnteqrasiyalar", RefreshCw], ["audit", "Audit tarixçəsi", History], ["settings", "Tənzimləmələr", Settings2],
] as const;
export function DashboardShell({ children, brandName, name, role }: { children: React.ReactNode; brandName: string; name: string; role: "ADMIN" | "PARTNER" }) {
  const path = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  const nav = role === "ADMIN" ? adminNav : [["", "Kabinetim", LayoutDashboard], ["#orders", "Referal sifarişləri", ShoppingBag], ["#earnings", "Qazanc və ödənişlər", Wallet], ["#qr", "QR kartım", ScanLine], ["#disputes", "Müraciətlər", MessagesSquare]] as const;
  return <div className="dashboard"><aside className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}><Link className="brand" href="/"><span className="brand-mark"><Sparkles size={20} /></span>{brandName}</Link><p className="sidebar-caption">{role === "ADMIN" ? "İDARƏETMƏ PANELİ" : "TƏRƏFDAŞ KABİNETİ"}</p><nav>{nav.map(([key, title, Icon]) => { const href = role === "ADMIN" ? `/admin/${key}` : `/partner${key}`; return <Link className={path === href || (path === "/admin" && key === "overview") ? "active" : ""} key={key} href={href} onClick={() => setOpen(false)}><Icon size={18} />{title}</Link>; })}</nav><Link className="sidebar-store" href="/">Mağazaya bax <ArrowUpRight size={16} /></Link><button className="sidebar-logout" onClick={async () => { await createAuthClient().signOut(); router.push("/login"); router.refresh(); }}><LogOut size={17} /> Çıxış</button></aside><div className="dashboard-main"><header className="dashboard-header"><button className="icon-btn dashboard-menu" aria-label="Menyu" onClick={() => setOpen(!open)}><Menu /></button><span>{role === "ADMIN" ? "Biznesiniz, bir baxışda." : "Tövsiyələrinizin dəyərini izləyin."}</span><div><span className="user-avatar">{name.slice(0, 1).toUpperCase()}</span><span>{name}<small>{role === "ADMIN" ? "Administrator" : "Tərəfdaş"}</small></span></div></header><main className="dashboard-content">{children}</main></div></div>;
}
