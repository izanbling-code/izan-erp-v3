import Link from "next/link";
import Image from "next/image";
import AddToCartButton from "@/app/components/AddToCartButton";
import StorefrontWelcomeFunnel from "@/app/components/StorefrontWelcomeFunnel";
import ShopNavbar from "@/app/components/ShopNavbar"; 
import type { SectionConfig } from "@/app/(storefront)/shop/admin/design/types";

interface ProductLite {
  id: string; name: string; salePrice: number;
  compareAtPrice: number | null; imageUrl: string | null;
}

export default function StorefrontSectionRenderer({
  section, products = [], storeName,
}: {
  section: SectionConfig;
  products?: ProductLite[];
  storeName?: string;
}) {
  const s = section.settings;

  switch (section.type) {
    case "navbar":
      return <ShopNavbar section={section} storeName={storeName} />;

    case "announcement-bar":
      return (
        <div style={{ background: s.bgColor, color: s.textColor, fontSize: s.fontSize, textAlign: s.alignment }} className="w-full px-4 py-3 font-semibold tracking-wide">
          {s.link ? <Link href={s.link}>{s.text}</Link> : s.text}
        </div>
      );

    case "hero-banner":
      return (
        <div
          className="relative w-full flex flex-col justify-center overflow-hidden"
          style={{
            minHeight: s.minHeight,
            paddingTop: s.paddingY,
            paddingBottom: s.paddingY,
            background: s.backgroundType === "color" ? s.backgroundColor : (s.imageUrl ? "#0f172a" : "var(--theme-surface)"),
          }}
        >
          {s.backgroundType === "image" && s.imageUrl && (
            <>
              <Image src={s.imageUrl} alt="" fill className="object-cover absolute inset-0 z-0" />
              <div className="absolute inset-0 z-[1]" style={{ background: `rgba(0,0,0,${s.overlayOpacity})` }} />
            </>
          )}
          <div className="relative z-10 max-w-5xl mx-auto px-6 w-full" style={{ textAlign: s.alignment }}>
            <h1
              style={{
                color: s.headingColor || s.textColor,
                fontSize: s.headingSize,
                fontFamily: s.headingFont ? s.headingFont : "var(--theme-heading-font)",
                fontWeight: "var(--theme-heading-weight)" as any,
              }}
              className="tracking-tight mb-4 leading-[1.05]"
            >
              {s.heading}
            </h1>
            {s.subheading && (
              <p style={{ color: s.textColor, fontFamily: "var(--theme-body-font)" }} className="text-base md:text-lg opacity-90 max-w-2xl mx-auto mb-8">
                {s.subheading}
              </p>
            )}
            {s.buttonLabel && (
              <Link href={s.buttonUrl || "/shop"} style={{ background: "var(--theme-primary)", borderRadius: "var(--theme-radius)" }} className="inline-block px-8 py-4 text-white font-bold hover:opacity-90 transition">
                {s.buttonLabel}
              </Link>
            )}
          </div>
        </div>
      );

    case "image-with-text": {
      const isLeft = s.layout === "image-left";
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className={`aspect-[4/5] relative bg-zinc-100 rounded-xl overflow-hidden ${isLeft ? "" : "md:order-2"}`}>
              {s.imageUrl ? <Image src={s.imageUrl} alt={s.heading} fill className="object-cover" /> : <div className="flex items-center justify-center h-full text-zinc-400 text-xs">No image</div>}
            </div>
            <div className={isLeft ? "" : "md:order-1"}>
              <h2 style={{ fontFamily: "var(--theme-heading-font)", fontWeight: "var(--theme-heading-weight)" as any }} className="text-3xl md:text-4xl tracking-tight mb-4">{s.heading}</h2>
              <p className="text-base opacity-80 mb-6 whitespace-pre-line">{s.body}</p>
              {s.buttonLabel && (
                <Link href={s.buttonUrl || "#"} className="inline-block px-6 py-3 rounded-lg font-semibold text-white" style={{ background: "var(--theme-primary)", borderRadius: "var(--theme-radius)" }}>
                  {s.buttonLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      );
    }

    case "featured-collection": {
      const list = products.slice(0, s.limit);
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 style={{ fontFamily: "var(--theme-heading-font)", fontWeight: "var(--theme-heading-weight)" as any }} className="text-3xl md:text-4xl tracking-tight mb-2">{s.heading}</h2>
              {s.subheading && <p className="text-sm opacity-70">{s.subheading}</p>}
            </div>
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${s.columns}, minmax(0, 1fr))` }}>
              {list.map((p) => {
                const isOnSale = p.compareAtPrice && p.compareAtPrice > p.salePrice;
                const img = p.imageUrl || `https://placehold.co/600x800?text=${encodeURIComponent(p.name)}`;
                const hoverClass = s.hoverAnimation === "hover-zoom" ? "group-hover:scale-105 transition-transform duration-700" : s.hoverAnimation === "hover-lift" ? "group-hover:-translate-y-2 transition-transform duration-300" : "";
                const shadowClass = s.cardShadow ? "shadow-lg p-3 bg-white" : "";

                return (
                  <div key={p.id} className={`group flex flex-col ${shadowClass}`} style={{ borderRadius: s.cardRadius }}>
                    <Link href={`/shop/product/${p.id}`} className="relative aspect-[4/5] overflow-hidden bg-zinc-100 mb-3" style={{ borderRadius: s.cardRadius }}>
                      {isOnSale && s.showSaleBadge && <span className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold uppercase px-2 py-1 rounded z-10">Sale</span>}
                      <Image src={img} alt={p.name} fill className={`object-cover ${hoverClass}`} />
                    </Link>
                    <Link href={`/shop/product/${p.id}`} className="text-sm font-semibold hover:text-teal-600">{p.name}</Link>
                    {s.showPrice && (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="font-medium">Rs. {p.salePrice.toLocaleString()}</span>
                        {isOnSale && <span className="text-xs line-through opacity-50">Rs. {p.compareAtPrice!.toLocaleString()}</span>}
                      </div>
                    )}
                    <AddToCartButton product={{ id: p.id, name: p.name, salePrice: p.salePrice, imageUrl: img }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    case "rich-text":
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-3xl mx-auto px-6" style={{ textAlign: s.alignment }}>
            <h2 style={{ fontSize: s.headingSize, fontFamily: "var(--theme-heading-font)", fontWeight: "var(--theme-heading-weight)" as any }} className="tracking-tight mb-4">{s.heading}</h2>
            <p className="text-base opacity-80 whitespace-pre-line">{s.body}</p>
          </div>
        </div>
      );

    case "multicolumn":
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center tracking-tight mb-10" style={{ fontFamily: "var(--theme-heading-font)" }}>{s.heading}</h2>
            <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${s.columns}, minmax(0, 1fr))` }}>
              {section.blocks.map((b) => (
                <div key={b.id} className="text-center">
                  <div className="text-4xl mb-3">{b.settings.icon}</div>
                  <h3 className="font-bold mb-2">{b.settings.title}</h3>
                  <p className="text-sm opacity-70">{b.settings.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "newsletter":
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--theme-heading-font)" }}>{s.heading}</h2>
            <p className="text-sm opacity-80 mb-6">{s.subheading}</p>
            <form className="flex gap-2 max-w-md mx-auto">
              <input type="email" placeholder="Your email" className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-sm placeholder:text-current placeholder:opacity-60 outline-none focus:border-white/40" />
              <button type="button" style={{ background: "var(--theme-primary)", borderRadius: "var(--theme-radius)" }} className="px-6 py-3 font-semibold text-white">{s.buttonLabel}</button>
            </form>
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: "var(--theme-heading-font)" }}>{s.heading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {section.blocks.map((b) => (
                <div key={b.id} className="p-6 rounded-xl" style={{ background: "var(--theme-bg)", border: "1px solid var(--theme-border)" }}>
                  <p className="text-sm italic mb-3">"{b.settings.quote}"</p>
                  <p className="text-xs font-bold opacity-70">— {b.settings.author}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "footer":
      return (
        <footer style={{ background: s.bgColor, color: s.textColor, paddingTop: s.paddingY, paddingBottom: s.paddingY }} className="w-full">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm">
            <div>
              <h3 className="font-bold tracking-widest uppercase text-white mb-1">{s.brandText}</h3>
              <p>{s.tagline}</p>
            </div>
            <p>{s.copyright}</p>
          </div>
        </footer>
      );

    case "welcome-funnel":
      return <StorefrontWelcomeFunnel section={section} quizData={(section as any).__quizData ?? null} />;

    default:
      return null;
  }
}