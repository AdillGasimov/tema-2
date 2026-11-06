import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login";
import { getSettings } from "@/lib/settings";
export const metadata = { title: "Giriş", robots: { index: false } };
export default async function Login() { const s = await getSettings(); return <main className="login-page"><div className="login-story"><Link className="brand" href="/"><BrandLogo brandName={s.brandName} logoKey={s.logoKey} faviconKey={s.faviconKey} dark /></Link><div><p className="eyebrow">HƏR DETALDA ETİBAR</p><h2>Yaxşı tərəfdaşlıq<br />şəffaflıqdan başlayır.</h2><p>Sifarişləriniz, qazancınız və biznesiniz bir yerdə.</p></div><span>Azərbaycan · AZN · Asia/Baku</span></div><LoginForm /></main>; }
