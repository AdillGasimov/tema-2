import { pageMetadata } from "@/lib/seo";
import { CartStorageNotice } from "@/components/cart-notice";
import { CartView } from "@/components/checkout";
export const generateMetadata = () => pageMetadata("Səbət", "Bu cihazdakı səbətinizdə məhsulları, miqdarı və məbləği yoxlayın. Sifarişdən əvvəl seçimlərinizi dəyişin və ya silin.", "/cart", true);
export default function CartPage() { return <div className="container content-page"><p className="eyebrow">SEÇİMLƏRİNİZ</p><h1>Səbətiniz</h1><CartStorageNotice /><CartView /></div>; }
