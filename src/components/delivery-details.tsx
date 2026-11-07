import { Clock3, MapPin, Truck, MessageCircle } from "lucide-react";
import { deliveryRegionList, freeDeliveryMessage } from "@/lib/delivery";
import { money } from "@/lib/money";
import type { PublicSettings } from "./store-shell";
export function DeliveryDetails({ settings: s }: { settings: PublicSettings }) {
  const free = deliveryRegionList(s.deliveryFreeRegions);
  return <section className="container delivery-policy" id="delivery" aria-labelledby="delivery-title"><p className="eyebrow">ÇATDIRILMA</p><h2 id="delivery-title">Sifarişiniz ünvanınıza gəlsin.</h2><div className="delivery-policy-grid">
    <div><MapPin size={23} /><h3>Çatdırılma əraziləri</h3><p>{deliveryRegionList(s.deliveryRegions).join(" · ")}</p></div>
    <div><Clock3 size={23} /><h3>Çatdırılma müddəti</h3><p>{s.deliveryTime || "Ünvanınıza uyğun çatdırılma vaxtı WhatsApp vasitəsilə fərdi razılaşdırılır."}</p></div>
    <div><Truck size={23} /><h3>Çatdırılma haqqı</h3>{free.length > 0 && <p><strong>{freeDeliveryMessage(s.deliveryFreeRegions)}</strong></p>}<p>{free.length ? "Digər ünvanlar" : "Standart çatdırılma"}: {money(s.deliveryFeeMinor)}.</p>{s.freeDeliveryMinor > 0 && <p>{money(s.freeDeliveryMinor)} və daha çox məhsul məbləğinə çatdırılma pulsuzdur.</p>}</div>
  </div><p className="delivery-confirmation"><MessageCircle size={20} /> Çatdırılmanın ünvanı, vaxtı və haqqı WhatsApp vasitəsilə təsdiqlənir.</p>{s.deliveryInfo && <p className="delivery-extra">{s.deliveryInfo}</p>}</section>;
}
