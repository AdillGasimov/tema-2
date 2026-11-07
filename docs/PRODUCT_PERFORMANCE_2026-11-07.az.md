# Məhsul səhifələrinin sürəti — 7 noyabr 2026

Gecikmə üçün iki təsdiqlənmiş səbəb tapıldı: hər məhsul açılışında köhnə URL yoxlaması üçün əlavə HTTP sorğusu və kiçik şəkillər üçün böyük orijinal faylların ötürülməsi.

İlkin ölçmə mobil Chromium-da (390 px, DPR 1) günəşlik səhifəsi üçün 3,749 saniyə ilk server cavabı və 5,072 saniyə əsas məzmunun görünmə vaxtını göstərdi. Ölçmə idarə olunan şəbəkə proksisi vasitəsilə aparılıb; istifadəçinin bağlantısı üçün zəmanət deyil.

URL tarixçəsi indi adi halda birbaşa indeksli sorğu ilə oxunur. Mövcud HTTP üsulu xəta zamanı ehtiyat yol kimi saxlanır. Köhnə ünvanların 301 yönləndirməsi, referal parametrləri və məhsulun yayım vəziyyətinin dərhal yoxlanması qorunur.

Məhsul, qalereya, loqo və ana səhifə şəkilləri ekran ölçüsünə uyğun hazırlanır. Orijinal fayllar saxlanır. Qaralama məhsulun şəkli administratorun girişindən istifadə etməklə belə açıq şəkil keşinə köçürülə bilməz.

Yoxlamalar: lint, TypeScript, 119 unit testi, 74 inteqrasiya testi və istehsal build-i keçdi. 21 fərqli brauzer ssenarisi əsas və təkrar yoxlamalar arasında keçdi; son dörd ssenari ayrıca təmiz test bazasında yoxlandı. Səbət, WhatsApp sifariş linki, filtrlər, qalereya, köhnə URL-lər, tərəfdaş girişi, CSV şəkilləri və sınaq sifarişinin maliyyə axını əhatə olunur. Canlı sifariş və mesaj yaradılmayıb.

Canlı yayımdan sonra eyni ölçmə qaydası ilə sürət və şəkil həcmi yenidən müqayisə ediləcək. Qiymət, stok, çatdırılma və sifariş qeydləri bu düzəlişlə dəyişdirilmir.
