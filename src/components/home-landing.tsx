import { publicImageSrc } from "@/lib/public-image";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Droplets, MessageCircle, Package, ScanLine, ShoppingBag, Sparkles } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { DeliveryDetails } from "./delivery-details";
import { ProductCard } from "./product-card";
import { TrustRow, type PublicSettings } from "./store-shell";

type HomeCategory = {
  id: string; name: string; slug: string; productCount: number;
  image: { key: string; alt: string } | null;
};

export function HomeLanding({ settings: s, categories, featured, arrivals }: {
  settings: PublicSettings; categories: HomeCategory[]; featured: PublicProduct[]; arrivals: PublicProduct[];
}) {
  const spotlight = featured.length > 0 ? featured : arrivals;
  return <div className="home-page">
    <section className="landing-hero" aria-labelledby="home-title">
      <div className="landing-hero-media">
        <Image src={s.heroImageKey ? publicImageSrc(s.heroImageKey) : "/images/storefront/hero.webp"}
          alt={s.heroImageKey ? "Avtomobilə qulluq kolleksiyası" : "İşıqlı studiyada parıldayan tünd rəngli avtomobil"}
          fill sizes="100vw" priority />
      </div>
      <div className="landing-hero-shade" />
      <div className="container landing-hero-inner">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><span /> AVTOMOBİLİNİZƏ LAYİQ QAYĞI</p>
          <h1 id="home-title">{s.heroTitle}</h1>
          <p className="landing-hero-description">{s.heroSubtitle}</p>
          <div className="landing-hero-actions">
            <Link className="btn btn-brand" href="/products">Məhsulları kəşf et <ArrowUpRight size={19} /></Link>
            <a href="#how-it-works" className="landing-hero-secondary">Necə sifariş etməli? <ArrowRight size={17} /></a>
          </div>
          <div className="landing-hero-footnote"><span /> Təmizlik. Rahatlıq. Hər detal.</div>
        </div>
      </div>
      <div className="landing-photo-caption"><Sparkles size={19} strokeWidth={1.5} /><span>Gündəlik qayğı.<strong>Hiss olunan fərq.</strong></span></div>
    </section>

    <TrustRow settings={s} />

    {s.showCategories && categories.length > 0 && <section className="container home-section" id="collection" aria-labelledby="categories-title">
      <div className="home-section-heading"><div><p className="eyebrow">KATEQORİYALAR</p><h2 id="categories-title">Axtardığınız, bir yerdə.</h2></div><Link href="/products" className="text-link">Bütün məhsullar <ArrowUpRight size={18} /></Link></div>
      <div className="home-categories">{categories.map(c => <Link href={`/products?category=${encodeURIComponent(c.slug)}`} key={c.id} className="home-category">
        <div className="home-category-visual">{c.image ? <Image src={publicImageSrc(c.image.key)} alt="" fill sizes="88px" /> : <Droplets size={36} strokeWidth={1.2} />}</div>
        <div><h3>{c.name}</h3><span>{c.productCount} məhsul</span></div><ArrowUpRight size={18} className="home-category-arrow" />
      </Link>)}</div>
    </section>}

    {s.showFeatured && <section className="container home-section" aria-labelledby="featured-title">
      <div className="home-section-heading"><div><p className="eyebrow">{featured.length > 0 ? "MAĞAZANIN SEÇİMİ" : "MƏHSULLARIMIZ"}</p><h2 id="featured-title">Kiçik detallar. Böyük fərq.</h2></div><Link href="/products" className="text-link">Hamısına bax <ArrowUpRight size={18} /></Link></div>
      {spotlight.length > 0 ? <div className="product-grid">{spotlight.map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="empty-collection"><Package strokeWidth={1} size={42} /><div><h3>Kolleksiyamız hazırlanır.</h3><p>Yeni məhsullar tezliklə burada görünəcək. Suallarınız üçün bizimlə əlaqə saxlayın.</p></div><Link href="/products" className="round-link" aria-label="Kataloqa bax"><ArrowUpRight /></Link></div>}
    </section>}

    <section className="container home-editorial" aria-labelledby="care-title">
      <div className="home-editorial-image"><Image src="/images/storefront/care.webp" alt="Mikrofiber dəsmalla avtomobilin üzərindəki su damcılarının silinməsi" fill sizes="(max-width: 760px) 100vw, 48vw" /></div>
      <div className="home-editorial-copy"><p className="eyebrow">HƏR GÜN BİR AZ QAYĞI</p><h2 id="care-title">Yaxşı görünüş<br />detallardan başlayır.</h2><p>Təmiz səthlər, rahat salon və xoş bir yol. Avtomobiliniz üçün gündəlik qulluq vasitələrini bir yerdə kəşf edin.</p><div className="home-editorial-points"><span><Droplets size={18} /> Gündəlik təmizlik</span><span><Sparkles size={18} /> Salon rahatlığı</span></div><Link className="btn btn-dark" href="/products">Kolleksiyaya bax <ArrowUpRight size={18} /></Link></div>
    </section>

    {s.showNewArrivals && arrivals.length > 0 && (featured.length > 0 || !s.showFeatured) && <section className="container home-section" aria-labelledby="arrivals-title">
      <div className="home-section-heading"><div><p className="eyebrow">YENİ GƏLƏNLƏR</p><h2 id="arrivals-title">Yeni favoritiniz burada ola bilər.</h2></div><Link href="/products?sort=newest" className="text-link">Yeniliklərə bax <ArrowUpRight size={18} /></Link></div>
      <div className="product-grid">{arrivals.map(p => <ProductCard key={p.id} product={p} />)}</div>
    </section>}

    <section className="container home-section home-ordering" id="how-it-works" aria-labelledby="ordering-title">
      <div className="home-section-heading"><div><p className="eyebrow">SİFARİŞ ETMƏK ASANDIR</p><h2 id="ordering-title">Üç addımda, rahatlıqla.</h2></div><span className="home-section-note">Seçimdən təsdiqə qədər yanınızdayıq.</span></div>
      <div className="home-steps">{[
        { n: "01", title: "Məhsulunuzu seçin", text: "Bəyəndiyiniz məhsulları səbətə əlavə edin.", Icon: ShoppingBag },
        { n: "02", title: "Sifarişi göndərin", text: "Məlumatlarınızı doldurun və WhatsApp mesajını göndərin.", Icon: MessageCircle },
        { n: "03", title: "Birlikdə təsdiqləyək", text: "Ödəniş və çatdırılma məlumatlarını sizinlə dəqiqləşdiririk.", Icon: Package },
      ].map(({ n, title, text, Icon }) => <div key={n} className="home-step"><div className="home-step-top"><Icon size={25} strokeWidth={1.4} /><span>{n}</span></div><h3>{title}</h3><p>{text}</p></div>)}</div>
    </section>

    <section className="container home-partner" aria-labelledby="partner-title"><div className="home-partner-icon"><ScanLine size={40} strokeWidth={1.3} /></div><div><p className="eyebrow">BİRLİKDƏ QAZANAQ</p><h2 id="partner-title">Tövsiyəniz dəyər qazansın.</h2><p>Fərdi referal kodu, QR kart və şəffaf komissiya tarixçəsi.</p></div><Link href="/partnership" className="btn btn-brand">Tərəfdaşlıq haqqında <ArrowUpRight size={18} /></Link></section>
    <DeliveryDetails settings={s} />
  </div>;
}
