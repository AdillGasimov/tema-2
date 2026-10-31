import { CheckoutForm } from "@/components/checkout";
import { publicSettings } from "@/lib/settings";
export const metadata = { title: "Sifariş", robots: { index: false } };
export default async function CheckoutPage() { return <div className="container content-page"><p className="eyebrow">QAYĞIYA BİR ADDIM QALDI</p><h1>Sifarişi rəsmiləşdirin.</h1><CheckoutForm settings={await publicSettings()} /></div>; }
