import Image from "next/image";
import Link from "next/link";
import { ICON_MAP } from "./ElementIcons";
import type { CanvasElement } from "../types";

interface ProductLite {
  id: string; name: string; salePrice: number;
  compareAtPrice: number | null; imageUrl: string | null;
}

export default function CanvasElementRenderer({
  element, products = [],
}: { element: CanvasElement; products?: ProductLite[] }) {
  const { type, content, style, frame } = element;
  if (element.hidden) return null;

  const base: React.CSSProperties = {
    width: "100%", height: "100%",
    opacity: style.opacity ?? 1,
    transform: frame.rotation ? `rotate(${frame.rotation}deg)` : undefined,
  };

  switch (type) {
    case "text":
      return (
        <div style={{
          ...base, display: "flex",
          alignItems: "center",
          justifyContent:
            style.textAlign === "center" ? "center"
            : style.textAlign === "right" ? "flex-end" : "flex-start",
          color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize,
          fontWeight: style.fontWeight, letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight, textAlign: style.textAlign,
          padding: style.padding, whiteSpace: "pre-wrap",
        }}>{content.text}</div>
      );

 // Update the "icon" and "button" cases in CanvasElementRenderer.tsx:

    case "icon": {
      const Icon = ICON_MAP[content.iconName] ?? ICON_MAP.Star;
      const iconContent = (
        <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", color: style.color }}>
          <Icon style={{ width: "100%", height: "100%" }} strokeWidth={content.strokeWidth ?? 2} />
        </div>
      );
      
      // If it has an href, wrap it in a Link
      return content.href ? (
        <Link href={content.href} draggable={false} style={{ display: "block", width: "100%", height: "100%" }}>
          {iconContent}
        </Link>
      ) : iconContent;
    }

    case "button": {
      const Icon = content.iconName ? ICON_MAP[content.iconName] : null;
      return (
        <Link href={content.href || "#"} target={content.target || "_self"} draggable={false} style={{
          ...base, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", // Added gap for icon spacing
          background: style.background, color: style.color,
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          borderRadius: style.borderRadius, padding: style.padding ?? "0 16px",
          textDecoration: "none",
        }}>
          {Icon && <Icon size={style.fontSize || 16} strokeWidth={2} />} {/* Render Icon */}
          {content.label}
        </Link>
      );
    }

    case "image":
      return (
        <div style={{ ...base, position: "relative", borderRadius: style.borderRadius, overflow: "hidden" }}>
          {content.url
            ? <Image src={content.url} alt={content.alt || ""} fill style={{ objectFit: content.objectFit || "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: "#e2e8f0" }} />}
        </div>
      );

    case "shape":
      return (
        <div style={{
          ...base,
          background: style.background,
          border: style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor}` : undefined,
          borderRadius: content.shape === "circle" ? "50%" : style.borderRadius,
        }} />
      );

    case "button":
      return (
        // FIXED: Added draggable={false} so it doesn't hijack the mouse drag
        <Link href={content.href || "#"} target={content.target || "_self"} draggable={false} style={{
          ...base, display: "flex", alignItems: "center", justifyContent: "center",
          background: style.background, color: style.color,
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          borderRadius: style.borderRadius, padding: style.padding ?? "0 16px",
          textDecoration: "none",
        }}>{content.label}</Link>
      );

    case "product-card": {
      const p = products.find(x => x.id === content.productId);
      if (!p) {
        return (
          <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px dashed #cbd5e1", borderRadius: style.borderRadius,
            color: "#94a3b8", fontSize: 12 }}>Select product</div>
        );
      }
      const img = p.imageUrl || `https://placehold.co/600x800?text=${encodeURIComponent(p.name)}`;
      return (
        <Link href={`/shop/product/${p.id}`} draggable={false} style={{ ...base, display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}>
          <div style={{ flex: 1, position: "relative", borderRadius: style.borderRadius, overflow: "hidden", background: "#f1f5f9" }}>
            <Image src={img} alt={p.name} fill style={{ objectFit: "cover" }} />
          </div>
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontFamily: style.fontFamily, color: style.color, fontSize: style.fontSize ?? 14, fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 13, color: style.color, opacity: 0.8 }}>Rs. {p.salePrice.toLocaleString()}</div>
          </div>
        </Link>
      );
    }

    case "divider":
      return <div style={{ ...base, background: style.background, alignSelf: "center" }} />;

    case "spacer":
      return <div style={base} />;

    default:
      return null;
  }
}