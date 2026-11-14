**CSV məhsullarının pulsuz Azərbaycan dilinə tərcüməsi**

CSV yoxlanarkən məhsulun adı, qısa və ətraflı təsviri Azərbaycan dilində hazırlanır. Tərcümə üçün hesab, API açarı və ödəniş kartı lazım deyil. **Ödənişli xidmətə avtomatik keçid yoxdur.**

Tərcümə [MyMemory-nin pulsuz xidmətindən](https://mymemory.translated.net/doc/usagelimits.php) istifadə edir. Anonim istifadə həddi gündə təxminən **5 000 simvoldur**; xidmət bu həddi və əlçatanlığını özü idarə edir. Vercel-in çıxış IP-si üzrə başqa istifadə bu limiti təsirləndirə bilər. Hədd bitəndə proses dayanır, ödəniş tutulmur. Bu dəyişiklik mövcud Vercel, verilənlər bazası və şəkil yaddaşı tariflərini dəyişmir.

**İstifadə**

1. Admin → **Məhsullar → CSV idxalı → Yeni məhsullar və şəkillər** seçin.
2. CSV faylını seçin. Satış qiyməti, maya dəyəri və stok doldurulmalıdır. Kateqoriya faylda boşdursa, **Ümumi kateqoriya** seçin. Böyük faylı kiçik hissələrlə işlədin.
3. **Faylı yoxla** basın. Ad və təsvirlər ardıcıl tərcümə edilir; variantlar üçün eyni məhsul təkrar tərcümə olunmur.
4. **Hazırlanmış mətnlər** və önizləmədə Azərbaycan dilini, model/ölçüləri və şəkilləri yoxlayın. Maşın tərcüməsi səhv edə bilər. Uzun tərcümə edilmiş ad və qısa təsvir avtomatik uyğunlaşdırılır; tam mətn ətraflı təsvirdə saxlanılır. Ad ən çox 160, qısa təsvir 500, ətraflı təsvir 20 000 simvol ola bilər.
5. **Azərbaycan dilində CSV-ni yüklə** ilə hazırlanmış faylı saxlayın. **Qaralamaları əlavə et** önizləmədəki həmin fayldan məhsulları qaralama kimi yaradır. Sonra məhsulları yoxlayıb yayımlayın.

**Hazır faylı təkrar istifadə**

Mağazadan yüklənmiş Azərbaycan dilində CSV-ni seçin və **“Hazır Azərbaycan dilində CSV-ni yoxlamışam; tərcüməsiz istifadə et”** işarəsini qoyun. Ad, qısa və ətraflı təsvirin Azərbaycan dilində olduğunu özünüz yoxlamalısınız. **Faylı yoxla** tərcümə xidmətinə müraciət etmədən normal önizləməni göstərir. Yeni, tərcümə edilməmiş təchizatçı CSV-si üçün bu işarəni qoymayın.

Hazır CSV-dəki `furycar_csv_format` sütununu saxlayın. Bu sütun cədvəldə təhlükəsiz mətn kodlamasını bildirir, dilin yoxlanıldığını sübut etmir. Natamam hazır təsvirlər və yararsız fayllar qəbul olunmur. Excel-də kodları mətn kimi qoruyun; SKU və variantları önizləmədə yoxlayın.

**Nə qorunur**

Qiymət, maya dəyəri, stok, endirim, daxili SKU, variant, kateqoriya və şəkil keçidləri tərcümə olunmur. Tərcümə xidmətinə yalnız məhsulun təqdimat mətni göndərilir; ayrıca maliyyə, stok, şəkil və müştəri sahələri göndərilmir. Mətn xarici xidmətə ötürüldüyü üçün CSV-yə məxfi məlumat daxil etməyin.

Yeni URL adı Azərbaycan dilində addan hazırlanır. Eyni URL-yə düşən məhsullar, mövcud SKU-lar və əvvəlki məhsul ünvanları üzrə xəta göstərilir. Mövcud yayımlanmış məhsullar və sifariş tarixçəsi avtomatik dəyişdirilmir. Şəkillər əvvəlki kimi mağazanın yaddaşına köçürülür.

**Limit və xətalar**

- Pulsuz gündəlik limit bitəndə daha sonra davam edin. Ödəniş kartı və balans artırmaq tələb olunmur. Xidmətə keçmək və ya limiti aşmaq üçün başqa provayderə avtomatik sorğu göndərilmir.
- **Tərcüməni dayandır** sonrakı sorğuları dayandırır. Açıq pəncərədə tamamlanmış məhsullar saxlanılır; **Tərcüməyə davam et** yalnız qalan məhsulları işləyir. Səhifəni bağlamaq/yeniləmək bu müvəqqəti nəticələri itirir. Tam hazır faylı yükləyib saxlayın.
- Kateqoriyanı dəyişmək mətnləri təkrar tərcümə etmir; önizləmə üçün **Faylı yoxla** basın. Yeni fayl, rejim və ya hazır-fayl seçimi əvvəlki sessiyanı təmizləyir.
- Rəqəm, vahid və ya model kodu dəyişərsə, cavab natamam olarsa, vaxt bitərsə və ya hazırlanmış CSV 512 KB həddini keçərsə idxal dayanır. Təchizatçı mətni tərcümə uğursuzluğu zamanı səssizcə idxal edilmir.
- **Mövcud məhsullara yalnız şəkil əlavə et** rejimi tərcümə etmir. Alınmayan şəkilləri ayrıca yenidən yoxlamaq mümkündür.

Texniki API həddi hər mətn sorğusu üçün 500 baytdır; uzun təsvirlər söz sərhədlərində bölünür. Hər məhsula ümumi 40 saniyə vaxt verilir. Bu pulsuz xidmətdə fasiləsiz iş və tərcümə keyfiyyətinə zəmanət yoxdur; önizləməni təsdiqdən əvvəl oxuyun. [API sənədi](https://mymemory.translated.net/doc/spec.php).
