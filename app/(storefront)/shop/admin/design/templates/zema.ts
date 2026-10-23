// app/(storefront)/shop/admin/design/templates/zema.ts
import { SECTION_REGISTRY, uid } from "../registry";

export const ZEMA_TEMPLATE = {
  theme: {
    colors: {
      primary: "#1A1A1A", // Dark luxury
      secondary: "#FFFFFF",
      accent: "#D4AF37", // Gold
      background: "#FAFAFA",
      surface: "#F0F0F0",
      text: "#1A1A1A",
      textMuted: "#666666",
      border: "#E5E5E5",
    },
    typography: {
      headingFont: "'Playfair Display', serif",
      bodyFont: "Inter, sans-serif",
      baseFontSize: "16px",
      headingWeight: "500",
    },
    logo: { url: "", width: 120, alt: "Store" },
    favicon: "",
    borderRadius: "0px", // Zema uses sharp edges
    sectionSpacing: "0px",
  },
  templates: {
    index: {
      sections: [
        { id: uid(), type: "navbar", name: "Navbar", settings: { ...SECTION_REGISTRY["navbar"].defaultSettings, bgColor: "#FFFFFF", textColor: "#1A1A1A" }, blocks: [] },
        { id: uid(), type: "hero-banner", name: "Hero", settings: { ...SECTION_REGISTRY["hero-banner"].defaultSettings, heading: "Find something new in every Zema collection", subheading: "Discover our curated collection of timeless pieces.", imageUrl: "https://images.unsplash.com/photo-1599643478514-4a4e5b6a4a58?q=80&w=2000&auto=format&fit=crop", textColor: "#FFFFFF", headingSize: 72 }, blocks: [] },
        { id: uid(), type: "featured-collection", name: "New Arrivals", settings: { ...SECTION_REGISTRY["featured-collection"].defaultSettings, heading: "New Arrivals", subheading: "Handpicked for you", columns: 4 }, blocks: [] },
        { id: uid(), type: "image-with-text", name: "About", settings: { ...SECTION_REGISTRY["image-with-text"].defaultSettings, heading: "Crafted with care", body: "Every piece is hand-finished by our artisans.", imageUrl: "https://images.unsplash.com/photo-1611591475281-8ec37e3040e6?q=80&w=1000&auto=format&fit=crop", layout: "image-right" }, blocks: [] },
        { id: uid(), type: "footer", name: "Footer", settings: { ...SECTION_REGISTRY["footer"].defaultSettings, bgColor: "#1A1A1A", textColor: "#FFFFFF" }, blocks: [] },
      ]
    },
    product: { sections: [] },
    collection: { sections: [] },
    page: { sections: [] },
    cart: { sections: [] },
    notFound: { sections: [] },
  }
};