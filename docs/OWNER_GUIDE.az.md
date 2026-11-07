# Mağaza sahibinin bələdçisi

## Giriş və ilkin tənzimləmələr

`/login` səhifəsində administrator hesabınıza daxil olun. Lokal mühitdə yaradılmış giriş məlumatları `.local/owner-credentials.json` faylındadır; bu faylı paylaşmayın və Git-ə əlavə etməyin. Canlı mağaza üçün ayrıca şəxsi hesab yaradılmalıdır. Eyni giriş səhifəsini tərəfdaşlar da istifadə edir.

Vercel-də ilk administrator üçün layihənin **Settings → Environment Variables** bölməsində **Production** mühitinə şəxsi `ADMIN_EMAIL` və 12–128 simvolluq `ADMIN_PASSWORD` əlavə edib yenidən deploy edin. Seçdiyiniz e-poçt və parolla daxil olduqdan sonra hər iki müvəqqəti dəyişəni silib yenidən deploy edin; hesab bazada saxlanılır. Mövcud hesabın parolu bu dəyişənlərlə dəyişmir. `BETTER_AUTH_SECRET` tətbiqin ayrıca texniki sirridir. Parolu çatda və ya ekran şəklində paylaşmayın.

**Tənzimləmələr** bölməsində mağazanın adını, domenini, loqosunu, faviconunu və rənglərini dəyişin. Real əlaqə məlumatlarını və WhatsApp nömrəsini ölkə kodu ilə daxil edin. WhatsApp boş olduqda sifariş qəbulu bağlıdır. Ana başlıq, banner şəkli, elan, görünən bölmələr və çatdırılma şərtləri də buradadır. Saxladıqdan sonra dəyişiklikləri mağazada yeniləmə ilə görün; tətbiqin yenidən build edilməsinə ehtiyac yoxdur.

FuryCar brendi üçün **Loqo** sahəsində tam yazılı loqo, **Favicon** sahəsində F nişanı saxlanılır. Açıq başlıq tam loqonu, tünd altlıq və panellər F nişanı ilə mağaza adını göstərir. Brendi sonradan dəyişəndə adı və uyğun şəkilləri birlikdə yeniləyin; növbəti deploy şəxsi dəyişikliklərinizi geri qaytarmır.

## Məhsul və anbar

1. **Kateqoriyalar** bölməsində kateqoriya və lazım olsa alt kateqoriya yaradın. Ana səhifədə göstərmək üçün uyğun xananı işarələyin.
2. **Məhsullar → Yeni məhsul** seçin. Ad, URL üçün kiçik latın hərfləri ilə slug, təsvir, kateqoriya və SKU daxil edin.
3. Hər variant üçün alış maya dəyərini, satış qiymətini, stok sayını və istəyə bağlı endirimli qiyməti AZN ilə yazın. Ölçü, rəng və paket sayını variant adı ilə ifadə edə bilərsiniz. Maya dəyəri müştəriyə və tərəfdaşa göstərilmir.
4. Məhsulu saxlayın, sonra şəkillərini yükləyin. JPG, PNG və WebP qəbul edilir; hər fayl ən çox 4 MB-dır. Şəkillər yoxlanılır və WebP-yə çevrilir. Bir məhsulda ən çox 12 şəkil ola bilər. Real məhsul fotoşəkillərindən istifadə edin.
5. Statusu **Yayımlanıb** edin. **Seçilmiş məhsul** xanası onu ana səhifədə göstərə bilər. Qaralama və arxiv məhsulları açıq kataloqda görünmür. Cədvəldə məhsulları seçərək statusu toplu dəyişə bilərsiniz. Surət düyməsi məhsulu yeni SKU/slug ilə yaratmağa kömək edir.
6. **Anbar** bölməsində artım üçün müsbət, azalma üçün mənfi say və səbəb daxil edin. Rezervdən az stok yazmaq mümkün deyil. Stok hərəkətləri jurnalda qalır.

**Əsas şəkil:** məhsulu redaktə edib qalereyada uyğun fotonun altındakı **Əsas şəkil et** düyməsinə basın. Həmin foto kataloqda və məhsul səhifəsində birinci görünür. Ağ fonlu, məhsulu tam göstərən foto seçin; istifadə nümunələrini digər şəkillərdə saxlayın. Kartlarda məhsul adı iki sətirdə göstərilir, tam adı məhsul səhifəsində açılır.

**Ad və kateqoriya:** adı Azərbaycan dilində qısa yazın, brend/modeli saxlayın; uzun xüsusiyyətləri təsvirə əlavə edin. CSV önizləməsində ad, kateqoriya və ilk şəkli birlikdə yoxlayın. `image_urls` sütununda ilk keçid əsas şəkildir; mövcud məhsulun üz şəklini sonradan yuxarıdakı düymə ilə dəyişə bilərsiniz.

**Məhsul silmək:** **Məhsullar** cədvəlində məhsulun yanındakı **Sil** düyməsinə basıb təsdiqləyin. Bir neçə məhsul üçün xanaları seçib **Seçilənləri sil** basın (bir əməliyyatda ən çox 100 məhsul). Məhsullar adi kataloqdan və saytdan çıxarılır. Sifarişlər, ödənişlər, əvvəlki qiymətlər, stok hərəkətləri və şəkillər saxlanılır; mövcud sifarişləri emal etməyə davam edə bilərsiniz.

Səhvən silmisinizsə **Silinmişlər → Bərpa et** seçin və ya bir neçə məhsulu seçib **Seçilənləri bərpa et** basın. Bərpa edilən məhsul **Qaralama** olur; yoxlayıb ayrıca yayımlayın. Eyni SKU və URL adını yeni məhsulda işlətmək əvəzinə əvvəlki məhsulu bərpa edin; tarixçəni qorumaq üçün bu kodlar saxlanılır.

Müştəri sifarişi 30 dəqiqəlik rezerv yaradır. Sadəcə WhatsApp pəncərəsinin açılması stoku satılmış etmir. Admin təsdiqi stoku çıxır; ləğv rezervi azad edir və ya çıxılmış stoku qaytarır. Bütün sifarişin fiziki qaytarılması ayrıca **Qaytarılıb** statusudur. Pulun geri ödənilməsi ayrıca maliyyə əməliyyatıdır.

### CSV ilə toplu məhsul əlavə etmək

1. Birmarket və Temu əlavəsindən **Tam CSV yüklə** seçin; bu faylda məhsul və şəkil keçidləri birlikdədir. Temu üçün əlavənin **1.1.0** versiyası lazımdır. Öz cədvəliniz üçün **Məhsullar → CSV idxalı → CSV şablonunu yüklə** seçə bilərsiniz. Şablon yalnız sütun başlıqlarını ehtiva edir; sətirləri öz real məhsullarınızla doldurun.
2. Excel və ya Google Sheets-də **Məhsul, SKU, Satış AZN, Maya AZN, Stok** sütunlarını doldurun. Qiymətlər AZN ilədir: `14.99` və ya `14,99`. Maya dəyərini və stoku boş qoymayın. `0` yalnız həqiqi dəyər sıfır olduqda yazılmalıdır.
3. **Kateqoriya** sütununda mağazadakı mövcud kateqoriyanın adını və ya URL adını istifadə edin. Bütün sətirlər eyni kateqoriyadırsa, sütunu boş saxlayıb idxal ekranında **Ümumi kateqoriya** seçə bilərsiniz. Yeni kateqoriyanı əvvəlcə **Kateqoriyalar** bölməsində yaradın.
4. **Təsvir, URL adı, Variant, Endirim AZN** istəyə bağlıdır. URL adı boşdursa addan hazırlanır, variant boşdursa **Standart** olur. Eyni URL adı olan sətirlər bir məhsulun variantları sayılır: məhsul adı, təsvir və kateqoriya eyni, SKU və variant adları fərqli olmalıdır. Bir məhsulda ən çox 30 variant qəbul edilir.
5. Cədvəli **CSV UTF-8** kimi saxlayın. Vergül, nöqtəli vergül və tab ayırıcıları qəbul edilir. Fayl ən çox **512 KB və 200 məhsul/variant sətiri** ola bilər. Daha böyük kataloqu ayrı fayllara bölün. Excel-in `.xlsx` formatını sadəcə `.csv` olaraq adlandırmaq kifayət etmir.
6. Faylı seçib **Faylı yoxla** düyməsinə basın. Bu mərhələ məhsul yaratmır. Xətalarda göstərilən sətirləri düzəldib yenidən yoxlayın. SKU və URL adları mağazada artıq varsa idxal saxlanılmır; mövcud məhsulları öz redaktorundan dəyişin.
7. **Yeni məhsullar və şəkillər** rejimində qiymətləri, maya dəyərini, stoku və şəkil sayını önizləmədə yoxlayıb **Qaralamaları əlavə et** seçin. Məhsul məlumatları bir əməliyyatla saxlanılır. Sonra şəkillər bir-bir yaddaşa köçürülür; bitənə qədər pəncərəni bağlamayın. Alınmayan şəkillər üçün **Alınmayan şəkilləri yenidən yoxla** düyməsi görünür. Bir şəkil xətası əlavə olunmuş məhsulları və digər şəkilləri silmir.
8. **image_urls** sütununda Birmarket və ya Temu məhsul şəkillərinin HTTPS keçidləri olmalıdır; bir neçə keçidi ` | ` ilə ayırın. Şəkillər mağazanın Blob/S3 yaddaşına köçürülür. Bir məhsulda ən çox 12 şəkil, hər şəkildə 4 MB həddi var. Əlavənin **Mağaza CSV-lərini yüklə** fayllarında şəkil keçidləri yoxdur; şəkillər üçün **Tam CSV yüklə** istifadə edin. Adi əl ilə şəkil yükləmə də işləyir. Hazır məhsulları seçərək toplu **Yayımla** tətbiq edə bilərsiniz.

İngilis sütunları ilə hazırlanmış fayllar da qəbul edilir: `name, sku, price, cost, stock, category, description, slug, variant, discount, image_urls`. Başlıqdan sonrakı hər sətir bir variantdır. Tam CSV-dəki mənbə məlumatları tanınır, lakin mənbənin qiyməti sizin satış qiymətiniz, maya dəyəriniz və ya stokunuz kimi götürülmür. Digər naməlum sütun varsa, öncə onu çıxarın və ya başlığını şablona uyğunlaşdırın.

**Məhsulları artıq idxal etmisinizsə:** əlavədən **Tam CSV yüklə**, sonra **Məhsullar → CSV idxalı → Mövcud məhsullara yalnız şəkil əlavə et (SKU ilə)** seçin. Faylı yoxlayıb **Şəkilləri əlavə et** basın. SKU mağazadakı ilə eyni olmalıdır. Bu rejimdə qiymət, maya dəyəri, stok, təsvir və yayım statusu dəyişmir; yalnız `sku` və `image_urls` tələb olunur. Əvvəl idxal olunmuş eyni şəkil təkrarlanmır. Pəncərəni bağlamısınızsa bu rejimlə qalan şəkilləri tamamlaya bilərsiniz.

**Temu məhsulları:** məhsulu öz Chrome pəncərənizdə açın; Temu giriş tələb edirsə saytda daxil olun. Məhsulun adı və şəkilləri göründükdən sonra **Bu məhsulu yadda saxla** basın. Kolleksiyada öz **Satış AZN**, **Maya AZN**, **Stok** və kateqoriyanızı doldurun, sonra **Tam CSV yüklə** seçin. Temu SKU-ları `TM-`, əvvəlki Birmarket SKU-ları `BM-` ilə başlayır. `source_price` və `source_currency` yalnız mənbə məlumatıdır: USD qiyməti avtomatik AZN sayılmır və çevrilmir.

Əlavəni yeniləyərkən əvvəl **Tam CSV** ehtiyat nüsxəsi çıxarın. Yeni ZIP-dəki faylları Chrome-un istifadə etdiyi **eyni əvvəlki əlavə qovluğuna** köçürüb dəyişdirin və `chrome://extensions` səhifəsində həmin əlavənin **Reload** düyməsinə basın. Əlavəni silməyin və kolleksiyanı təmizləməyin; başqa qovluğu yeni əlavə kimi yükləmək ayrıca yaddaş yarada bilər. Ətraflı təlimat əlavə qovluğundakı `README.md` faylındadır.

**“Şəkil yaddaşı konfiqurasiya edilməyib”** xətası olduqda Vercel layihəsinin **Storage → Blob** bölməsində **Private** yaddaş yaradın və ya mövcud private yaddaşı layihənin **Production** mühitinə qoşun. Vercel qoşulma üsulundan asılı olaraq `BLOB_STORE_ID` və ya `BLOB_READ_WRITE_TOKEN` təqdim edə bilər. `BLOB_STORE_ID` ilə tətbiq Vercel-in təqdim etdiyi kimlikdən SDK vasitəsilə istifadə edir; ayrıca token əlavə etmək tələb olunmur. Son versiyanı yenidən deploy edin. Mövcud S3 yaddaşı ilə işləyirsinizsə, onun dəyişənləri `docs/VERCEL.md` sənədindədir; saxlanmış şəkilləri köçürmədən yaddaş növünü dəyişməyin.

**“Sifariş qəbulu hələ aktiv deyil”** yazısı **Tənzimləmələr → WhatsApp nömrəsi** sahəsi boş olduqda görünür. Həqiqi iş nömrənizi ölkə kodu ilə yazın, **Bütün tənzimləmələri saxla** düyməsinə basın və sifariş səhifəsini yeniləyin. Bu dəyişiklik deploy tələb etmir.

## Tərəfdaş və QR kart

**Tərəfdaşlar → Yeni tərəfdaş** seçin. Ad, telefon, sahə, unikal referal kodu və ən azı 12 simvolluq ilk parol daxil edin. E-poçt istəyə bağlıdır: e-poçt yazılıbsa tərəfdaş onunla, boşdursa referal kodu ilə daxil olur. İlk parolu təhlükəsiz kanalla çatdırın; tərəfdaş kabinetdə onu dəyişə bilər. Yeni hesab avtomatik bank və ya WhatsApp mesajı göndərmir.

Kod böyük hərflərə çevrilir və təkrar istifadə edilə bilməz. Tarixçəni qorumaq üçün yaradılmış kod dəyişdirilmir. Tərəfdaşı dayandırmaq yeni referal qəbulunu və hesab girişini bağlayır, keçmiş sifariş və ödənişləri silmir. Fərdi komissiya boşdursa standart qayda istifadə olunur.

Hər sətirdə linki kopyalamaq, PNG/SVG QR yükləmək və PDF kartı endirmək mümkündür. **QR kartlar** bölməsində bir neçə tərəfdaşı seçib birlikdə PDF hazırlayın (ən çox 300). Çap ölçüsü 85 × 55 mm-dir, PDF-də əlavə 3 mm kəsim payı və kəsim işarələri var. Çapda “actual size / 100%” seçin, “fit to page” istifadə etməyin. Əvvəl bir nümunəni telefonda skan edib yoxlayın. Domeni kartları çap etməzdən əvvəl son ünvanla əvəz edin.

Etibarlı referal linki standart olaraq 30 gün yadda qalır. Birbaşa giriş onu silmir; son etibarlı link əvvəlkini əvəz edə bilər. Checkout-da müştərinin əl ilə yazdığı etibarlı kod üstünlük təşkil edir; sahəni təmizləməsi referalı silir. Bu izləmə eyni cihaz/kuki daxilində işləyir, başqa cihaz üçün zəmanət verilmir.

## Sifarişin emalı

1. **Sifarişlər** cədvəlində yeni sorğunu yoxlayın və müştəri ilə dəqiqləşdirəndən sonra həmin sətirdə **Təsdiqlə** basın. İlk status **WhatsApp təsdiqi gözlənilir**, ödəniş **Ödənilməyib** olur. WhatsApp pəncərəsinin açılması mesajın göndərildiyini sübut etmir.
2. Məhsul faktiki müştəriyə çatanda cədvəldə və ya sifariş detalında **Çatdırıldı** basın. Hazırlanır və Yoldadır mərhələlərini ayrıca seçmək məcburi deyil. Tam ödəniş artıq qeydə alınıbsa, sifariş həmin kliklə **Tamamlanıb** olur və uyğun referal komissiyası yaranır.
3. Həqiqətən aldığınız pulu **Ödəniş / geri ödəniş** formasında yazın. Məbləğ, üsul və əməliyyat istinadı mütləqdir. Eyni sorğunu təkrar göndərmək ödənişi iki dəfə yaratmır. Başqa ayrıca ödəniş daxil edəcəksinizsə **Yeni ödəniş əməliyyatı başlat** seçin.
4. Biznesin çatdırılma və qablaşdırma xərclərini sifarişdə qeyd edin. Onları **Ümumi xərclər** bölməsinə bir daha yazmayın.
5. Çatdırılma təsdiqlənib, amma ödəniş tam deyilsə sifariş **Çatdırılıb** qalır. Son ödənişi qeydə alanda sistem onu avtomatik tamamlayır. Əvvəldən çatdırılmış və tam ödənilmiş sifarişlərdə görünən **Tamamla** düyməsi də bir kliklə işləyir. Sifarişin qiymətləri və maya dəyəri dəyişmir; tamamlama əlavə ödəniş və ya ikinci stok çıxışı yaratmır.
6. Ləğv, qaytarma və istəyə bağlı ətraflı statuslar üçün **Digər status əməliyyatları** bölməsini açın. Ləğv və ya qaytarma pulu avtomatik geri köçürmür; faktiki geri ödənişi ayrıca qeydə alın. Komissiya uyğun qaydada geri çevrilir.

## Ana səhifənin görünüşü

**Biznes məlumatları:** Saytın aşağı hissəsində ayrıca biznes məlumatları bloku göstərilmir. Tənzimləmələrdə hüquqi ad, VÖEN və ünvan saxlanıla bilər; hüquqi ad və ünvan daxil edildikdə siyasət səhifələrinin əlaqə hissəsində görünür. Əlaqə nömrəsi üçün **Əlaqə telefonu**, boşdursa mövcud WhatsApp nömrəsi işlədilir.

**Çatdırılma:** bölgələr, pulsuz çatdırılma bölgələri, müddət və standart haqq həmin bölmədə dəyişir. Pulsuz bölgə adını bölgə siyahısındakı kimi yazın. Sifarişdə seçilən ünvana görə haqq avtomatik hesablanır; köhnə sifarişlərin haqqı dəyişmir. Razılaşdırılmış cari qayda: 28 May (Bakı) pulsuz, digər ünvanlar 5 ₼; 3 iş günü, rayonlara 4 iş günü. Dəqiq tarix WhatsApp-da təsdiqlənir.

**Məhsul mətni və URL:** redaktədə **Qısa təsvir** yuxarıda, tam təsvir aşağıda göstərilir. CSV-də istəyə bağlı **Qısa təsvir** / `short_description` sütunu da qəbul olunur. Qısa Azərbaycan dilində URL seçin. Sonradan URL dəyişdikdə köhnə keçid avtomatik 301 ilə cari ünvana yönlənir; başqa məhsul həmin köhnə URL-ni götürə bilməz. Tək aktiv variant varsa seçim siyahısı göstərilmir.

**Qiymət yoxlaması:** kataloqda “Qiyməti təsdiqləyin” xəbərdarlığı qiyməti avtomatik dəyişmir. Düzgün məbləği təsdiqləyib redaktədə qiyməti yazın, **Qiymət yoxlaması tələb olunur** işarəsini çıxarın və saxlayın. Tarixi sifariş qiymətləri qorunur. Günəşlik üçün 100 ₼ qiyməti ayrıca təsdiq gözləyir.

**Tənzimləmələr → Vitrin və ana səhifə** bölməsində başlıq, alt mətn və əsas banner şəklini dəyişin. **Ana başlıq** sahəsində Enter ilə sətir ayırmaq olar; digər tənzimləmələri saxlayanda bu sətirlər itmir. Öz bannerinizi seçmədikdə dizayna daxil edilmiş avtomobil fotosu göstərilir. Şəxsi banner üçün üfüqi, təxminən 16:9 ölçülü, mətnin yerləşəcəyi sol hissəsi sadə foto seçin.

Kateqoriya şəkilləri və məhsul sayları yalnız yayımlanmış kataloqdan götürülür. Seçilmiş məhsul yoxdursa, ilk məhsul bölməsində həqiqi yeni məhsullar göstərilir; eyni siyahı aşağıda təkrarlanmır. Ayrı yeni məhsul bölməsi, seçilmiş məhsullar və kateqoriyalar əvvəlki seçim düymələri ilə idarə edilir. Ana səhifənin qulluq fotosu ümumi vizualdır; məhsul kartlarında hər məhsulun öz qalereya şəkli qalır.

## Komissiya və ödəniş

**Tənzimləmələr** bölməsində standart komissiya, minimum sifariş, gözləmə müddəti və ödəniş tezliyi təyin edilir. Yeni qaydalar yalnız yeni sifarişlərə tətbiq olunur. Standart model hər uyğun sifariş üçün bir sabit komissiyadır; məhsul üzrə qayda olduqda ən yüksək məbləğ, tərəfdaşın fərdi qaydası olduqda isə həmin məbləğ istifadə olunur.

**Komissiyalar** bölməsində gözləmə müddəti bitmiş qeydi **Təsdiqlə**, sonra **Ödənişə hazır et** seçin. QR skanı, baxış və WhatsApp açılması komissiya yaratmır.

Tərəfdaşa faktiki bank/nağd ödənişi etdikdən sonra **Ödənişlər** bölməsində onu seçin, konkret hazır komissiyaları işarələyin, üsul və istinad yazın. Sistem məbləği dəqiq hesablayır və həmin komissiyaları bağlayır. Eyni komissiyanı ikinci ödənişə əlavə etmək mümkün deyil. Bank köçürməsi sistem tərəfindən icra edilmir.

Ödənilmiş komissiya qaytarma səbəbindən geri çevrilərsə, əvvəlki ödəniş saxlanılır və mənfi düzəliş yaranır. Bu borc növbəti müsbət ödənişdən çıxılır. Sıfır/mənfi yekunla nağd ödəniş yaradılmır; əlavə komissiyalar toplandıqda bağlanır.

## Kabinet, müraciətlər və hesabatlar

Tərəfdaş kabinetində yalnız öz sifariş nömrələri, statuslar, komissiyalar, düzəlişlər və ödənişlər görünür. Müştəri telefonu/ünvanı, alış maya dəyəri və mağaza mənfəəti göstərilmir. Referal uyğunsuzluğu üçün tərəfdaş müraciət göndərə bilər. Admin onu **Müraciətlər** bölməsində araşdırır, nəticə və izah yazır. Açıq, komissiya yaranmamış sifarişdə referal düzəlişi səbəb və auditlə mümkündür. Tamamlanmış sifarişin tərəfdaşını dəyişmək bu buraxılışda bloklanır; belə mübahisəni maliyyə tarixçəsini pozaraq həll etməyin.

**Analitika** toplanmış pulu, geri ödənişləri, çatdırılmış məhsulların tarixi maya dəyərini, komissiya və xərcləri göstərir. Sorğu yaradılması gəlir deyil. Tarix filtri sifarişin yaranma tarixinə görə kohort seçir; seçilmiş sifarişlərin indiyə qədərki maliyyə nəticəsi görünür. “Xərclərdən sonra töhfə” tam mühasibat xalis mənfəəti deyil. Vergi və digər uçot öhdəlikləri ayrıca nəzərə alınmalıdır.

**Hesabatlar** bölməsində sifariş, məhsul/stok, xərc, ödəniş və maliyyə CSV-lərini tarix aralığı ilə endirin. QR kartları PDF formatındadır. Google Sheets istəyə bağlıdır və texniki quraşdırma tələb edir; baza həmişə əsas mənbə olaraq qalır.

## Mağaza kodları, stok təsdiqi və nişanların yoxlanması

**Mağaza SKU-su:** FC-0001 formatında kod hər variant üçün avtomatik və təkrarsız yaradılır. Sayt, məhsulun strukturlaşdırılmış məlumatı və yeni sifarişlər bu kodu istifadə edir. Əvvəlki TM/BM kodları admin daxilində CSV və şəkil idxalını uyğunlaşdırmaq üçün saxlanılır; yeni CSV fayllarında həmin mənbə kodunu istifadə edə bilərsiniz. Keçmiş sifarişlərin kod və qiymət sətirləri dəyişdirilmir.

**Fiziki stok:** Məhsul redaktəsində və ya Anbar bölməsində sayımı etdikdən sonra **Fiziki stok sayını yoxlamışam** işarəsini seçin. Anbarda yalnız təsdiq üçün say dəyişikliyini 0 saxlayın və səbəbi yazın. Müsbət, təsdiqli və rezervdən artıq qalıq Stokda göstərilir. Müsbət, təsdiqsiz qalıq Mövcudluğu dəqiqləşdirin kimi görünür; sayları uyduraraq sıfırlamaq lazım deyil. CSV-dən gələn say özü-özlüyündə fiziki təsdiq deyil. Yeni say düzəlişi ayrıca təsdiq olmadan əvvəlki təsdiqi ləğv edir.

**Nişanlar üzrə hüquq yoxlaması:** DİN gerbi, Qarabağ FK və dövlət rəmzləri təsvirli dörd məhsul hüquq sənədləri yoxlanana qədər Qaralama saxlanılır. Məhsulda **Nişanlar üzrə hüquq yoxlaması gözlənilir** işarəsi varkən yayımlamaq və kütləvi yayımlamaq mümkün deyil. Təchizat, məhsulun orijinallığı, nişandan/təsvirdən və fotoşəkildən istifadə əsasları barədə sənədləri yoxlayın. Sonra **Hüquq yoxlamasının nəticəsi və sənəd istinadı** sahəsini doldurun, işarəni götürün və yayımlayın. Bu, administratorun sənədləşdirdiyi qərardır; proqram hüquqi icazəni özü müəyyənləşdirmir.

**Qaytarılma:** Sahibin istədiyi 3 təqvim günü operativ müraciət tövsiyəsidir. Məcburi qanuni hüquqların son tarixi deyil. Qanunun tətbiq olunduğu hallarda 14 günlük dəyişdirmə və elektron müqavilələr üçün 7 iş günlük imtina qaydaları ayrıca göstərilir. Rəsmi mənbələr qaytarılma səhifəsindədir.

**Qiymətlərin yenilənməsi:** Səbət cihazda qalır, lakin qiymət, başlıq, mövcud hədd və satışdan çıxan məhsullar açıldıqda və brauzer yenidən fokuslandıqda serverdən yenilənir. Son sifariş yenə serverdə yoxlanılır. İnternet kəsildikdə saxlanmış səbət qalır.
