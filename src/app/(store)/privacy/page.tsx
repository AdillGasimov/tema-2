import { publicSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";
import { PolicyContact } from "@/components/policy-contact";
export const generateMetadata = () => pageMetadata("Məxfilik siyasəti", "Sifariş, çatdırılma, referal kukiləri və şəxsi məlumatların saxlanılması haqqında məxfilik siyasəti. Məlumat sorğuları üçün əlaqə kanalları.", "/privacy");
export default async function Privacy() {
  const s = await publicSettings();
  return <div className="container content-page prose"><p className="eyebrow">MƏLUMATLARINIZ HAQQINDA</p><h1>Məxfilik siyasəti</h1>
    <h2>Toplanan məlumatlar və istifadə məqsədi</h2><p>{s.brandName} sifarişin qəbulu, sizinlə əlaqə, çatdırılma və sifarişin uçotu üçün ad, telefon, ünvan, sifariş və təqdim etdiyiniz əlavə qeydləri emal edir. Hesab girişləri üçün sessiya və təhlükəsizlik məlumatlarından istifadə olunur.</p>
    <h2>WhatsApp və çatdırılma</h2><p>WhatsApp mesajını göndərdiyiniz zaman mesajdakı sifariş və əlaqə məlumatları həmin xidmətə ötürülür və WhatsApp-ın məxfilik qaydaları da tətbiq olunur. Çatdırılma üçün zəruri məlumatlar sifarişin icrasına cəlb edilən tərəfə verilə bilər.</p>
    <h2>Referal, kukilər və səbət</h2><p>Referal linki açdıqda etibarlı tərəfdaş kodu müddətli, qorunan kukidə saxlanılır. Tərəfdaşlar öz referal sifarişlərinin nömrəsini, statusunu və komissiyasını görür; müştərinin telefon və ünvanı onlara göstərilmir. Hesablar qorunan sessiya kukilərindən istifadə edir. Səbət yalnız istifadə etdiyiniz cihazdakı brauzerin yerli yaddaşında saxlanılır və digər cihazlarla sinxronlaşmır.</p>
    <h2>Saxlama və silinmə</h2><p>Məlumatlar sifarişin icrası, müraciətlərin həlli və mühasibat və hüquqi öhdəliklər üçün zəruri olan müddətdə saxlanılır. Bu məqsədlər və tətbiq olunan qanuni saxlama tələbləri aradan qalxdıqda məlumatlar silinir və ya şəxsi müəyyən etməyə imkan verməyən formaya salınır. Girişi iş üçün zəruri səlahiyyətlərlə məhdudlaşdırırıq.</p>
    <h2>Məlumatlarla bağlı müraciətlər</h2><p>Məlumatlarınızın dəqiqləşdirilməsi, emalı və qanunun icazə verdiyi həddə silinməsi barədə aşağıdakı əlaqə kanallarından müraciət edə bilərsiniz. Müraciətin təhlükəsiz cavablandırılması üçün şəxsiyyətiniz və sifarişinizlə əlaqəniz dəqiqləşdirilə bilər.</p><PolicyContact settings={s} />
  </div>;
}
