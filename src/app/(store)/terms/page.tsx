import Link from "next/link";
import { publicSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";
import { PolicyContact } from "@/components/policy-contact";
import { FreeDeliveryNote } from "@/components/free-delivery-note";
export const generateMetadata = () => pageMetadata("İstifadə və satış şərtləri", "Məhsul seçimi, sifarişin WhatsApp vasitəsilə təsdiqi, qiymət, ödəniş və çatdırılma ilə bağlı istifadə və satış şərtləri.", "/terms");
export default async function Terms() {
  const s = await publicSettings();
  return <div className="container content-page prose"><p className="eyebrow">AYDIN SİFARİŞ QAYDALARI</p><h1>İstifadə və satış şərtləri</h1>
    <h2>Mağaza və əlaqə</h2><p>{s.brandName} avtomobil aksesuarları və qulluq məhsullarının seçilməsi və sifariş sorğusunun göndərilməsi üçün onlayn mağazadır. Satıcı ilə əlaqə məlumatları aşağıda və saytın biznes məlumatları bölməsində göstərilir.</p>
    <h2>Sifarişin verilməsi və təsdiqi</h2><p>Məhsulu və uyğun variantı seçib səbətə əlavə edin. Əlaqə və çatdırılma məlumatlarını doldurduqdan sonra sifariş sorğusu qeydə alınır. Açılan WhatsApp pəncərəsində mesajı özünüz göndərməlisiniz. Sifarişin mövcudluğu, yekun məlumatları, ödəniş və çatdırılma şərtləri WhatsApp vasitəsilə ayrıca təsdiqlənir. Pəncərənin açılması mesajın göndərilməsi və ya sifarişin ödənilməsi demək deyil.</p>
    <h2>Qiymət və ödəniş</h2><p>Qiymətlər Azərbaycan manatı ilə göstərilir. Səbətdə saxlanan qiymət və stok sifariş qeydə alınarkən serverdə yenidən yoxlanılır. Çatdırılma haqqı sifariş xülasəsində ayrıca göstərilir. Ödəniş üsulu WhatsApp-da razılaşdırılır; sayt bank kartı məlumatlarını toplamır.</p>
    <h2>Çatdırılma və stok</h2><FreeDeliveryNote regions={s.deliveryFreeRegions} /><p>Çatdırılma ərazisi və haqqı <Link href="/#delivery">çatdırılma bölməsində</Link> göstərilir. Dəqiq vaxt və ünvan sifariş təsdiq edilərkən razılaşdırılır. Səbətə əlavə etmək məhsulu rezerv etmir; stok sifariş zamanı yoxlanılır.</p>
    <h2>Dəyişiklik, ləğv və qaytarılma</h2><p>Sifarişdə düzəliş və ya ləğv üçün mümkün qədər tez bizimlə əlaqə saxlayın. Çatdırılma mərhələsindən asılı olaraq mümkün həll razılaşdırılır. <Link href="/returns">Qaytarılma və dəyişdirmə qaydaları</Link> və qanunvericiliyin verdiyi istehlakçı hüquqları tətbiq olunur.</p>
    <h2>Şəxsi məlumatlar</h2><p>Məlumatların emalı <Link href="/privacy">məxfilik siyasətində</Link> izah olunur. Bu şərtlər qanunvericiliklə müəyyən edilən məcburi istehlakçı hüquqlarını məhdudlaşdırmır.</p><PolicyContact settings={s} />
  </div>;
}
