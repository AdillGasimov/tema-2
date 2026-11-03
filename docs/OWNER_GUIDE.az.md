# Mağaza sahibinin bələdçisi

## Giriş və ilkin tənzimləmələr

`/login` səhifəsində administrator hesabınıza daxil olun. Lokal mühitdə yaradılmış giriş məlumatları `.local/owner-credentials.json` faylındadır; bu faylı paylaşmayın və Git-ə əlavə etməyin. Canlı mağaza üçün ayrıca şəxsi hesab yaradılmalıdır. Eyni giriş səhifəsini tərəfdaşlar da istifadə edir.

Vercel-də ilk administrator üçün layihənin **Settings → Environment Variables** bölməsində **Production** mühitinə şəxsi `ADMIN_EMAIL` və 12–128 simvolluq `ADMIN_PASSWORD` əlavə edib yenidən deploy edin. Seçdiyiniz e-poçt və parolla daxil olduqdan sonra hər iki müvəqqəti dəyişəni silib yenidən deploy edin; hesab bazada saxlanılır. Mövcud hesabın parolu bu dəyişənlərlə dəyişmir. `BETTER_AUTH_SECRET` tətbiqin ayrıca texniki sirridir. Parolu çatda və ya ekran şəklində paylaşmayın.

**Tənzimləmələr** bölməsində mağazanın adını, domenini, loqosunu, faviconunu və rənglərini dəyişin. Real əlaqə məlumatlarını və WhatsApp nömrəsini ölkə kodu ilə daxil edin. WhatsApp boş olduqda sifariş qəbulu bağlıdır. Ana başlıq, banner şəkli, elan, görünən bölmələr və çatdırılma şərtləri də buradadır. Saxladıqdan sonra dəyişiklikləri mağazada yeniləmə ilə görün; tətbiqin yenidən build edilməsinə ehtiyac yoxdur.

## Məhsul və anbar

1. **Kateqoriyalar** bölməsində kateqoriya və lazım olsa alt kateqoriya yaradın. Ana səhifədə göstərmək üçün uyğun xananı işarələyin.
2. **Məhsullar → Yeni məhsul** seçin. Ad, URL üçün kiçik latın hərfləri ilə slug, təsvir, kateqoriya və SKU daxil edin.
3. Hər variant üçün alış maya dəyərini, satış qiymətini, stok sayını və istəyə bağlı endirimli qiyməti AZN ilə yazın. Ölçü, rəng və paket sayını variant adı ilə ifadə edə bilərsiniz. Maya dəyəri müştəriyə və tərəfdaşa göstərilmir.
4. Məhsulu saxlayın, sonra şəkillərini yükləyin. JPG, PNG və WebP qəbul edilir; hər fayl ən çox 4 MB-dır. Şəkillər yoxlanılır və WebP-yə çevrilir. Bir məhsulda ən çox 12 şəkil ola bilər. Real məhsul fotoşəkillərindən istifadə edin.
5. Statusu **Yayımlanıb** edin. **Seçilmiş məhsul** xanası onu ana səhifədə göstərə bilər. Qaralama və arxiv məhsulları açıq kataloqda görünmür. Cədvəldə məhsulları seçərək statusu toplu dəyişə bilərsiniz. Surət düyməsi məhsulu yeni SKU/slug ilə yaratmağa kömək edir.
6. **Anbar** bölməsində artım üçün müsbət, azalma üçün mənfi say və səbəb daxil edin. Rezervdən az stok yazmaq mümkün deyil. Stok hərəkətləri jurnalda qalır.

Müştəri sifarişi 30 dəqiqəlik rezerv yaradır. Sadəcə WhatsApp pəncərəsinin açılması stoku satılmış etmir. Admin təsdiqi stoku çıxır; ləğv rezervi azad edir və ya çıxılmış stoku qaytarır. Bütün sifarişin fiziki qaytarılması ayrıca **Qaytarılıb** statusudur. Pulun geri ödənilməsi ayrıca maliyyə əməliyyatıdır.

**“Şəkil yaddaşı konfiqurasiya edilməyib”** xətası olduqda Vercel layihəsinin **Storage → Blob** bölməsində **Private** yaddaş yaradın və ya mövcud private yaddaşı layihənin **Production** mühitinə qoşun. Vercel qoşulma üsulundan asılı olaraq `BLOB_STORE_ID` və ya `BLOB_READ_WRITE_TOKEN` təqdim edə bilər. `BLOB_STORE_ID` ilə tətbiq Vercel-in təqdim etdiyi kimlikdən SDK vasitəsilə istifadə edir; ayrıca token əlavə etmək tələb olunmur. Son versiyanı yenidən deploy edin. Mövcud S3 yaddaşı ilə işləyirsinizsə, onun dəyişənləri `docs/VERCEL.md` sənədindədir; saxlanmış şəkilləri köçürmədən yaddaş növünü dəyişməyin.

**“Sifariş qəbulu hələ aktiv deyil”** yazısı **Tənzimləmələr → WhatsApp nömrəsi** sahəsi boş olduqda görünür. Həqiqi iş nömrənizi ölkə kodu ilə yazın, **Bütün tənzimləmələri saxla** düyməsinə basın və sifariş səhifəsini yeniləyin. Bu dəyişiklik deploy tələb etmir.

## Tərəfdaş və QR kart

**Tərəfdaşlar → Yeni tərəfdaş** seçin. Ad, telefon, sahə, unikal referal kodu və ən azı 12 simvolluq ilk parol daxil edin. E-poçt istəyə bağlıdır: e-poçt yazılıbsa tərəfdaş onunla, boşdursa referal kodu ilə daxil olur. İlk parolu təhlükəsiz kanalla çatdırın; tərəfdaş kabinetdə onu dəyişə bilər. Yeni hesab avtomatik bank və ya WhatsApp mesajı göndərmir.

Kod böyük hərflərə çevrilir və təkrar istifadə edilə bilməz. Tarixçəni qorumaq üçün yaradılmış kod dəyişdirilmir. Tərəfdaşı dayandırmaq yeni referal qəbulunu və hesab girişini bağlayır, keçmiş sifariş və ödənişləri silmir. Fərdi komissiya boşdursa standart qayda istifadə olunur.

Hər sətirdə linki kopyalamaq, PNG/SVG QR yükləmək və PDF kartı endirmək mümkündür. **QR kartlar** bölməsində bir neçə tərəfdaşı seçib birlikdə PDF hazırlayın (ən çox 300). Çap ölçüsü 85 × 55 mm-dir, PDF-də əlavə 3 mm kəsim payı və kəsim işarələri var. Çapda “actual size / 100%” seçin, “fit to page” istifadə etməyin. Əvvəl bir nümunəni telefonda skan edib yoxlayın. Domeni kartları çap etməzdən əvvəl son ünvanla əvəz edin.

Etibarlı referal linki standart olaraq 30 gün yadda qalır. Birbaşa giriş onu silmir; son etibarlı link əvvəlkini əvəz edə bilər. Checkout-da müştərinin əl ilə yazdığı etibarlı kod üstünlük təşkil edir; sahəni təmizləməsi referalı silir. Bu izləmə eyni cihaz/kuki daxilində işləyir, başqa cihaz üçün zəmanət verilmir.

## Sifarişin emalı

1. **Sifarişlər** bölməsində yeni sorğunu açın. İlk status **WhatsApp təsdiqi gözlənilir**, ödəniş **Ödənilməyib** olur. Müştərinin WhatsApp mesajını özünüz yoxlayın: pəncərənin açılması mesajın göndərildiyini sübut etmir.
2. Məhsul və ünvanı müştəri ilə dəqiqləşdirin, sonra **Təsdiqlənib → Hazırlanır → Yoldadır → Çatdırılıb** statuslarına keçirin.
3. Həqiqətən aldığınız pulu **Ödəniş / geri ödəniş** formasında yazın. Məbləğ, üsul və əməliyyat istinadı mütləqdir. Eyni sorğunu təkrar göndərmək ödənişi iki dəfə yaratmır. Başqa ayrıca ödəniş daxil edəcəksinizsə **Yeni ödəniş əməliyyatı başlat** seçin.
4. Biznesin çatdırılma və qablaşdırma xərclərini sifarişdə qeyd edin. Onları **Ümumi xərclər** bölməsinə bir daha yazmayın.
5. Yalnız tam ödəniş və çatdırılmadan sonra **Tamamlanıb** edin. Sifarişin qiymətləri və maya dəyəri sonradan məhsul dəyişəndə dəyişmir.
6. Ləğv və ya qaytarma pulu avtomatik geri köçürmür. Faktiki geri ödənişi ayrıca qeydə alın. Komissiya uyğun qaydada geri çevrilir.

## Komissiya və ödəniş

**Tənzimləmələr** bölməsində standart komissiya, minimum sifariş, gözləmə müddəti və ödəniş tezliyi təyin edilir. Yeni qaydalar yalnız yeni sifarişlərə tətbiq olunur. Standart model hər uyğun sifariş üçün bir sabit komissiyadır; məhsul üzrə qayda olduqda ən yüksək məbləğ, tərəfdaşın fərdi qaydası olduqda isə həmin məbləğ istifadə olunur.

**Komissiyalar** bölməsində gözləmə müddəti bitmiş qeydi **Təsdiqlə**, sonra **Ödənişə hazır et** seçin. QR skanı, baxış və WhatsApp açılması komissiya yaratmır.

Tərəfdaşa faktiki bank/nağd ödənişi etdikdən sonra **Ödənişlər** bölməsində onu seçin, konkret hazır komissiyaları işarələyin, üsul və istinad yazın. Sistem məbləği dəqiq hesablayır və həmin komissiyaları bağlayır. Eyni komissiyanı ikinci ödənişə əlavə etmək mümkün deyil. Bank köçürməsi sistem tərəfindən icra edilmir.

Ödənilmiş komissiya qaytarma səbəbindən geri çevrilərsə, əvvəlki ödəniş saxlanılır və mənfi düzəliş yaranır. Bu borc növbəti müsbət ödənişdən çıxılır. Sıfır/mənfi yekunla nağd ödəniş yaradılmır; əlavə komissiyalar toplandıqda bağlanır.

## Kabinet, müraciətlər və hesabatlar

Tərəfdaş kabinetində yalnız öz sifariş nömrələri, statuslar, komissiyalar, düzəlişlər və ödənişlər görünür. Müştəri telefonu/ünvanı, alış maya dəyəri və mağaza mənfəəti göstərilmir. Referal uyğunsuzluğu üçün tərəfdaş müraciət göndərə bilər. Admin onu **Müraciətlər** bölməsində araşdırır, nəticə və izah yazır. Açıq, komissiya yaranmamış sifarişdə referal düzəlişi səbəb və auditlə mümkündür. Tamamlanmış sifarişin tərəfdaşını dəyişmək bu buraxılışda bloklanır; belə mübahisəni maliyyə tarixçəsini pozaraq həll etməyin.

**Analitika** toplanmış pulu, geri ödənişləri, çatdırılmış məhsulların tarixi maya dəyərini, komissiya və xərcləri göstərir. Sorğu yaradılması gəlir deyil. Tarix filtri sifarişin yaranma tarixinə görə kohort seçir; seçilmiş sifarişlərin indiyə qədərki maliyyə nəticəsi görünür. “Xərclərdən sonra töhfə” tam mühasibat xalis mənfəəti deyil. Vergi və digər uçot öhdəlikləri ayrıca nəzərə alınmalıdır.

**Hesabatlar** bölməsində sifariş, məhsul/stok, xərc, ödəniş və maliyyə CSV-lərini tarix aralığı ilə endirin. QR kartları PDF formatındadır. Google Sheets istəyə bağlıdır və texniki quraşdırma tələb edir; baza həmişə əsas mənbə olaraq qalır.
