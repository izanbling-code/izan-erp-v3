import type { SectionSchema, BlockConfig } from "./types";
import type { CanvasElement, ElementType, ElementFrame, ElementStyle } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const SECTION_REGISTRY: Record<string, SectionSchema> = {
  "announcement-bar": {
    type: "announcement-bar",
    label: "Announcement Bar",
    icon: "Megaphone",
    category: "header",
    defaultSettings: {
      text: "Free shipping on orders over Rs. 5,000",
      bgColor: "#0f172a",
      textColor: "#ffffff",
      fontSize: 13,
      alignment: "center",
      link: "",
    },
    settingsSchema: [
      { key: "text", type: "text", label: "Text", default: "" },
      { key: "link", type: "url", label: "Link (optional)", default: "" },
      { key: "bgColor", type: "color", label: "Background", default: "#0f172a" },
      { key: "textColor", type: "color", label: "Text color", default: "#ffffff" },
      { key: "fontSize", type: "range", label: "Font size", min: 10, max: 20, default: 13 },
      { key: "alignment", type: "alignment", label: "Alignment", default: "center" },
    ],
  },

  navbar: {
    type: "navbar",
    label: "Navigation Bar",
    icon: "Menu",
    category: "header",
    allowsBlocks: true,
    blockSchema: [
      { key: "label", type: "text", label: "Link Label (Optional)", default: "" },
      { key: "href", type: "url", label: "Link URL", default: "/shop" },
      { key: "icon", type: "icon", label: "Icon (Optional)", default: "" },
    ],
    defaultBlocks: [
      { id: uid(), type: "nav-item", settings: { label: "Shop", href: "/shop", icon: "" } },
      { id: uid(), type: "nav-item", settings: { label: "Our Story", href: "/shop", icon: "" } },
      { id: uid(), type: "nav-item", settings: { label: "", href: "/shop/account", icon: "User" } },
      { id: uid(), type: "nav-item", settings: { label: "", href: "/shop/cart", icon: "ShoppingCart" } },
    ] as BlockConfig[],
    defaultSettings: {
      brandName: "IZAN BLING",
      bgColor: "#ffffff",
      textColor: "#0f172a",
      paddingY: 24,
    },
    settingsSchema: [
      { key: "brandName", type: "text", label: "Brand Name", default: "IZAN BLING" },
      { key: "bgColor", type: "color", label: "Background", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding", min: 8, max: 64, default: 24 },
    ],
  },

  "hero-banner": {
    type: "hero-banner",
    label: "Hero Banner",
    icon: "Image",
    category: "content",
    defaultSettings: {
      heading: "Elevate Your Aesthetic",
      subheading: "Discover our curated collection of timeless pieces.",
      buttonLabel: "Shop Now",
      buttonUrl: "/shop",
      backgroundType: "image",
      backgroundColor: "#0f172a",
      imageUrl: "",
      overlayOpacity: 0.45,
      textColor: "#ffffff",
      alignment: "center",
      minHeight: 520,
      headingSize: 56,
      headingFont: "",
      headingColor: "#ffffff",
      paddingY: 80,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading Text", default: "Elevate Your Aesthetic" },
      { key: "subheading", type: "textarea", label: "Subheading Text", default: "" },
      { key: "buttonLabel", type: "text", label: "Button label", default: "" },
      { key: "buttonUrl", type: "url", label: "Button URL", default: "" },
      { key: "alignment", type: "alignment", label: "Text alignment", default: "center" },
      { key: "backgroundType", type: "select", label: "Background Type", default: "image", options: [{ label: "Image", value: "image" }, { label: "Solid Color", value: "color" }] },
      { key: "backgroundColor", type: "color", label: "Background Color", default: "#0f172a" },
      { key: "imageUrl", type: "image", label: "Background image", default: "" },
      { key: "overlayOpacity", type: "range", label: "Overlay opacity", min: 0, max: 1, step: 0.05, default: 0.45 },
      { key: "headingFont", type: "font", label: "Heading Font", default: "" },
      { key: "headingSize", type: "range", label: "Heading size (px)", min: 24, max: 100, default: 56 },
      { key: "headingColor", type: "color", label: "Heading Color", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Subheading Color", default: "#ffffff" },
      { key: "minHeight", type: "range", label: "Min height (px)", min: 320, max: 800, default: 520 },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  "image-with-text": {
    type: "image-with-text",
    label: "Image with Text",
    icon: "LayoutPanelLeft",
    category: "content",
    defaultSettings: {
      heading: "Crafted with care",
      body: "Every piece is hand-finished by our artisans.",
      imageUrl: "",
      layout: "image-left",
      buttonLabel: "Learn more",
      buttonUrl: "",
      bgColor: "#ffffff",
      textColor: "#0f172a",
      paddingY: 80,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "body", type: "textarea", label: "Body", default: "" },
      { key: "imageUrl", type: "image", label: "Image", default: "" },
      { key: "layout", type: "select", label: "Layout", default: "image-left", options: [{ label: "Image left", value: "image-left" }, { label: "Image right", value: "image-right" }] },
      { key: "buttonLabel", type: "text", label: "Button label", default: "" },
      { key: "buttonUrl", type: "url", label: "Button URL", default: "" },
      { key: "bgColor", type: "color", label: "Background", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  "featured-collection": {
    type: "featured-collection",
    label: "Featured Collection",
    icon: "Grid3x3",
    category: "products",
    defaultSettings: {
      heading: "New Arrivals",
      subheading: "Handpicked for you",
      limit: 8,
      columns: 4,
      bgColor: "#ffffff",
      textColor: "#0f172a",
      paddingY: 80,
      showPrice: true,
      showSaleBadge: true,
      hoverAnimation: "hover-zoom",
      cardRadius: 12,
      cardShadow: true,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "subheading", type: "text", label: "Subheading", default: "" },
      { key: "limit", type: "range", label: "Products to show", min: 2, max: 24, default: 8 },
      { key: "columns", type: "range", label: "Columns (desktop)", min: 2, max: 5, default: 4 },
      { key: "showPrice", type: "boolean", label: "Show price", default: true },
      { key: "showSaleBadge", type: "boolean", label: "Show sale badge", default: true },
      { key: "hoverAnimation", type: "animation", label: "Hover Animation", default: "hover-zoom" },
      { key: "cardRadius", type: "range", label: "Card Border Radius", min: 0, max: 40, default: 12 },
      { key: "cardShadow", type: "boolean", label: "Show Card Shadow", default: true },
      { key: "bgColor", type: "color", label: "Background", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  "rich-text": {
    type: "rich-text",
    label: "Rich Text",
    icon: "Type",
    category: "content",
    defaultSettings: {
      heading: "Our Story",
      body: "Tell your customers what makes your brand unique.",
      alignment: "center",
      bgColor: "#ffffff",
      textColor: "#0f172a",
      paddingY: 64,
      headingSize: 36,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "body", type: "richtext", label: "Body", default: "" },
      { key: "alignment", type: "alignment", label: "Alignment", default: "center" },
      { key: "headingSize", type: "range", label: "Heading size (px)", min: 16, max: 72, default: 36 },
      { key: "bgColor", type: "color", label: "Background", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 64 },
    ],
  },

  multicolumn: {
    type: "multicolumn",
    label: "Multicolumn",
    icon: "Columns3",
    category: "content",
    defaultSettings: {
      heading: "Why shop with us",
      columns: 3,
      bgColor: "#ffffff",
      textColor: "#0f172a",
      paddingY: 80,
    },
    allowsBlocks: true,
    blockSchema: [
      { key: "icon", type: "text", label: "Icon (emoji)", default: "✨" },
      { key: "title", type: "text", label: "Title", default: "Title" },
      { key: "body", type: "textarea", label: "Body", default: "" },
    ],
    defaultBlocks: [
      { id: uid(), type: "column", settings: { icon: "🚚", title: "Free Shipping", body: "On all orders over Rs. 5,000" } },
      { id: uid(), type: "column", settings: { icon: "🔄", title: "Easy Returns", body: "14-day hassle-free returns" } },
      { id: uid(), type: "column", settings: { icon: "💎", title: "Premium Quality", body: "Handcrafted by artisans" } },
    ] as BlockConfig[],
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "columns", type: "range", label: "Columns", min: 2, max: 4, default: 3 },
      { key: "bgColor", type: "color", label: "Background", default: "#ffffff" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  newsletter: {
    type: "newsletter",
    label: "Newsletter",
    icon: "Mail",
    category: "content",
    defaultSettings: {
      heading: "Join our list",
      subheading: "Be first to know about new arrivals.",
      buttonLabel: "Subscribe",
      bgColor: "#0f172a",
      textColor: "#ffffff",
      paddingY: 80,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "subheading", type: "textarea", label: "Subheading", default: "" },
      { key: "buttonLabel", type: "text", label: "Button label", default: "" },
      { key: "bgColor", type: "color", label: "Background", default: "#0f172a" },
      { key: "textColor", type: "color", label: "Text color", default: "#ffffff" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  testimonials: {
    type: "testimonials",
    label: "Testimonials",
    icon: "Quote",
    category: "content",
    defaultSettings: {
      heading: "Loved by our customers",
      bgColor: "#f8fafc",
      textColor: "#0f172a",
      paddingY: 80,
    },
    allowsBlocks: true,
    blockSchema: [
      { key: "quote", type: "textarea", label: "Quote", default: "" },
      { key: "author", type: "text", label: "Author", default: "" },
    ],
    defaultBlocks: [
      { id: uid(), type: "testimonial", settings: { quote: "Absolutely stunning quality.", author: "Ayesha K." } },
    ] as BlockConfig[],
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "" },
      { key: "bgColor", type: "color", label: "Background", default: "#f8fafc" },
      { key: "textColor", type: "color", label: "Text color", default: "#0f172a" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 80 },
    ],
  },

  footer: {
    type: "footer",
    label: "Footer",
    icon: "PanelBottom",
    category: "footer",
    defaultSettings: {
      brandText: "Izan Bling",
      tagline: "Elevate your aesthetic.",
      copyright: "© 2026 Izan Bling. All rights reserved.",
      bgColor: "#0f172a",
      textColor: "#94a3b8",
      paddingY: 48,
    },
    settingsSchema: [
      { key: "brandText", type: "text", label: "Brand name", default: "" },
      { key: "tagline", type: "text", label: "Tagline", default: "" },
      { key: "copyright", type: "text", label: "Copyright", default: "" },
      { key: "bgColor", type: "color", label: "Background", default: "#0f172a" },
      { key: "textColor", type: "color", label: "Text color", default: "#94a3b8" },
      { key: "paddingY", type: "range", label: "Vertical padding (px)", min: 0, max: 200, default: 48 },
    ],
  },

  "welcome-funnel": {
    type: "welcome-funnel",
    label: "Welcome Funnel",
    icon: "Sparkles",
    category: "content",
    defaultSettings: {
      heading: "Define Your Aesthetic",
      subheading: "Skip the endless scrolling. Tell us about your style, and we will curate the perfect pieces exclusively for you.",
      buttonLabel: "Begin the Experience",
      backgroundImageUrl: "",
      backgroundColor: "#0a0a0a",
      overlayOpacity: 0.55,
      textColor: "#ffffff",
      accentColor: "#14b8a6",
      showSparkle: true,
    },
    settingsSchema: [
      { key: "heading", type: "text", label: "Heading", default: "Define Your Aesthetic" },
      { key: "subheading", type: "textarea", label: "Subheading", default: "" },
      { key: "buttonLabel", type: "text", label: "Button label", default: "" },
      { key: "backgroundImageUrl", type: "image", label: "Background image", default: "" },
      { key: "backgroundColor", type: "color", label: "Background color", default: "#0a0a0a" },
      { key: "overlayOpacity", type: "range", label: "Image overlay opacity", min: 0, max: 1, step: 0.05, default: 0.55 },
      { key: "textColor", type: "color", label: "Text color", default: "#ffffff" },
      { key: "accentColor", type: "color", label: "Accent color", default: "#14b8a6" },
      { key: "showSparkle", type: "boolean", label: "Show sparkle icon", default: true },
    ],
  },
};

export const DEFAULT_THEME = {
  colors: {
    primary: "#0d9488",
    secondary: "#0f172a",
    accent: "#f59e0b",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
  },
  typography: {
    headingFont: "Inter, sans-serif",
    bodyFont: "Inter, sans-serif",
    baseFontSize: "16px",
    headingWeight: "700",
  },
  logo: { url: "", width: 120, alt: "Izan Bling" },
  favicon: "",
  borderRadius: "12px",
  sectionSpacing: "0px",
};

export const DEFAULT_HOME_TEMPLATE = {
  sections: [
    { id: uid(), type: "announcement-bar", name: "Announcement Bar", settings: { ...SECTION_REGISTRY["announcement-bar"].defaultSettings }, blocks: [] },
    { id: uid(), type: "navbar", name: "Navbar", settings: { ...SECTION_REGISTRY["navbar"].defaultSettings }, blocks: SECTION_REGISTRY["navbar"].defaultBlocks || [] },
    { id: uid(), type: "hero-banner", name: "Hero Banner", settings: { ...SECTION_REGISTRY["hero-banner"].defaultSettings }, blocks: [] },
    { id: uid(), type: "featured-collection", name: "Featured Collection", settings: { ...SECTION_REGISTRY["featured-collection"].defaultSettings }, blocks: [] },
    { id: uid(), type: "multicolumn", name: "Multicolumn", settings: { ...SECTION_REGISTRY["multicolumn"].defaultSettings }, blocks: SECTION_REGISTRY["multicolumn"].defaultBlocks || [] },
    { id: uid(), type: "newsletter", name: "Newsletter", settings: { ...SECTION_REGISTRY["newsletter"].defaultSettings }, blocks: [] },
    { id: uid(), type: "footer", name: "Footer", settings: { ...SECTION_REGISTRY["footer"].defaultSettings }, blocks: [] },
  ],
};

export function createSection(type: string) {
  const schema = SECTION_REGISTRY[type];
  if (!schema) throw new Error(`Unknown section: ${type}`);
  return {
    id: uid(),
    type,
    name: schema.label,
    settings: { ...schema.defaultSettings },
    blocks: schema.defaultBlocks ? schema.defaultBlocks.map((b) => ({ ...b, id: uid() })) : [],
  };
}

export const FONT_LIBRARY = [
  { family: "Inter",              value: "Inter, sans-serif" },
  { family: "Poppins",            value: "Poppins, sans-serif" },
  { family: "DM Sans",            value: "'DM Sans', sans-serif" },
  { family: "Manrope",            value: "Manrope, sans-serif" },
  { family: "Montserrat",         value: "Montserrat, sans-serif" },
  { family: "Space Grotesk",      value: "'Space Grotesk', sans-serif" },
  { family: "Bebas Neue",         value: "'Bebas Neue', sans-serif" },
  { family: "Playfair Display",   value: "'Playfair Display', serif" },
  { family: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { family: "Lora",               value: "Lora, serif" },
];

interface ElementDef {
  label: string;
  icon: string;
  defaultFrame: Omit<ElementFrame, "zIndex">;
  defaultStyle: ElementStyle;
  defaultContent: Record<string, any>;
}

export const ELEMENT_REGISTRY: Record<ElementType, ElementDef> = {
  text: {
    label: "Text", icon: "Type",
    defaultFrame: { x: 40, y: 40, width: 320, height: 80, rotation: 0 },
    defaultStyle: { fontSize: 24, fontWeight: 600, color: "#0f172a", textAlign: "left", lineHeight: 1.2 },
    defaultContent: { text: "Your text here" },
  },
  icon: {
    label: "Icon", icon: "Star",
    defaultFrame: { x: 40, y: 40, width: 64, height: 64, rotation: 0 },
    defaultStyle: { color: "#0f172a" },
    defaultContent: { iconName: "Sparkles", strokeWidth: 2 },
  },
  image: {
    label: "Image", icon: "Image",
    defaultFrame: { x: 40, y: 40, width: 240, height: 240, rotation: 0 },
    defaultStyle: { borderRadius: 12 },
    defaultContent: { url: "", alt: "", objectFit: "cover" },
  },
  shape: {
    label: "Shape", icon: "Square",
    defaultFrame: { x: 40, y: 40, width: 120, height: 120, rotation: 0 },
    defaultStyle: { background: "#14b8a6", borderRadius: 8 },
    defaultContent: { shape: "rectangle" },
  },
  button: {
    label: "Button", icon: "MousePointerClick",
    defaultFrame: { x: 40, y: 40, width: 160, height: 48, rotation: 0 },
    defaultStyle: { background: "#14b8a6", color: "#ffffff", fontSize: 14, fontWeight: 600, borderRadius: 8 },
    defaultContent: { label: "Shop now", href: "/shop", target: "_self" },
  },
  "product-card": {
    label: "Product Card", icon: "ShoppingBag",
    defaultFrame: { x: 40, y: 40, width: 220, height: 320, rotation: 0 },
    defaultStyle: { borderRadius: 12, fontSize: 14 },
    defaultContent: { productId: "" },
  },
  divider: {
    label: "Divider", icon: "Minus",
    defaultFrame: { x: 40, y: 40, width: 300, height: 2, rotation: 0 },
    defaultStyle: { background: "#e2e8f0" },
    defaultContent: {},
  },
  spacer: {
    label: "Spacer", icon: "Square",
    defaultFrame: { x: 40, y: 40, width: 200, height: 100, rotation: 0 },
    defaultStyle: {},
    defaultContent: {},
  },
};

export function createElement(
  type: ElementType,
  opts: Partial<CanvasElement> = {}
): CanvasElement {
  const def = ELEMENT_REGISTRY[type];
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    name: def.label,
    ...opts,
    frame: { ...def.defaultFrame, zIndex: 1, ...(opts.frame ?? {}) },
    style: { ...def.defaultStyle, ...(opts.style ?? {}) },
    content: { ...def.defaultContent, ...(opts.content ?? {}) },
  };
}