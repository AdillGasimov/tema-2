import { pageMetadata } from "@/lib/seo";
import { CartStorageNotice } from "@/components/cart-notice";
import { CheckoutForm } from "@/components/checkout";
import { publicSettings } from "@/lib/settings";
export const generateMetadata = () => pageMetadata("Sifarişin rəsmiləşdirilməsi", "Əlaqə və ünvan məlumatlarını daxil edin, çatdırılma haqqını yoxlayın və sifarişinizi WhatsApp vasitəsilə təsdiqləyin.", "/checkout", true);
export default async function CheckoutPage() { return <div className="container content-page"><p className="eyebrow">QAYĞIYA BİR ADDIM QALDI</p><h1>Sifarişi rəsmiləşdirin.</h1><CartStorageNotice /><CheckoutForm settings={await publicSettings()} /></div>; }
