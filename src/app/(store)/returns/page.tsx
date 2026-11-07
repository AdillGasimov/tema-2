import Link from "next/link";
import { publicSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";
import { PolicyContact } from "@/components/policy-contact";
export const generateMetadata = () => pageMetadata("Qaytarılma və dəyişdirmə", "Qüsurlu, yanlış və ya uyğun olmayan məhsulla bağlı qaytarılma və dəyişdirmə müraciəti, yoxlama və geri ödəniş qaydaları.", "/returns");
export default async function Returns() {
  const s = await publicSettings();
  return <div className="container content-page prose"><p className="eyebrow">ALIŞDAN SONRA DƏSTƏK</p><h1>Qaytarılma və dəyişdirmə</h1>
    <h2>Müraciəti necə göndərmək olar?</h2><p>Sifariş nömrəsini, məhsulun adını və müraciətin səbəbini WhatsApp və ya aşağıdakı əlaqə kanalı ilə göndərin. Problem barədə foto və ya əlavə məlumat araşdırmaya kömək edə bilər. Məhsulu geri göndərməzdən əvvəl ünvanı və çatdırılma üsulunu bizimlə dəqiqləşdirin.</p>
    <h2>Qüsurlu və ya yanlış məhsul</h2><p>Təhvil aldığınız məhsul sifarişdən fərqlidirsə və ya qüsur aşkar etmisinizsə, bizimlə əlaqə saxlayın. Vəziyyət araşdırıldıqdan sonra tətbiq olunan qanunvericiliyə uyğun olaraq dəyişdirmə, qüsurun aradan qaldırılması və ya geri ödəniş kimi həll yolları nəzərdən keçirilir.</p>
    <h2>Uyğun gəlməyən məhsul</h2><p>İstifadə edilməmiş məhsul üzrə dəyişdirmə və qaytarılma müraciətləri qanunvericilikdə nəzərdə tutulan müddət, məhsulun növü və digər şərtlər əsasında qiymətləndirilir. Məhsulun görünüşü, istehlak xüsusiyyətləri, komplektliyi və mövcud alış sənədləri yoxlama üçün əhəmiyyətlidir. Bəzi məhsul növlərinə qanuni istisnalar tətbiq oluna bilər.</p>
    <h2>Geri göndərmə və ödəniş</h2><p>Geri göndərmə ünvanı, üsulu və logistika xərci müraciətin səbəbi nəzərə alınaraq əvvəlcədən razılaşdırılır. Geri ödəniş təsdiqləndikdə məbləğ və qaytarılma üsulu sizinlə dəqiqləşdirilir. Sifarişin sistemdə ləğv edilməsi pulun avtomatik köçürülməsi demək deyil.</p>
    <h2>Hüquqlarınız</h2><p>Bu qaydalar Azərbaycan Respublikasının qanunvericiliyi ilə verilən istehlakçı hüquqlarınızı məhdudlaşdırmır. Sifarişin ümumi qaydaları <Link href="/terms">istifadə və satış şərtlərində</Link> göstərilir.</p><PolicyContact settings={s} />
  </div>;
}
