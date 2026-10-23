export type TemplateKey =
  | "index"
  | "product"
  | "collection"
  | "page"
  | "cart"
  | "notFound";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: string;
    headingWeight: string;
  };
  logo: { url: string; width: number; alt: string };
  favicon: string;
  borderRadius: string;
  sectionSpacing: string;
}

export interface BlockConfig {
  id: string;
  type: string;
  settings: Record<string, any>;
}

export interface ElementFrame {
  x: number; y: number; width: number; height: number;
  rotation: number; zIndex: number;
}

export interface ElementBreakpointOverride {
  x?: number; y?: number; width?: number; height?: number;
}

export interface ElementStyle {
  color?: string;
  background?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  padding?: number;
  boxShadow?: string;
}

export type ElementType =
  | "text" | "icon" | "image" | "shape"
  | "button" | "product-card" | "divider" | "spacer";

export interface CanvasElement {
  id: string;
  type: ElementType;
  name: string;
  hidden?: boolean;
  locked?: boolean;
  frame: ElementFrame;
  tablet?: ElementBreakpointOverride;
  mobile?: ElementBreakpointOverride;
  style: ElementStyle;
  content: Record<string, any>;
}

export interface SectionConfig {
  id: string;
  type: string;
  name: string;
  disabled?: boolean;
  settings: Record<string, any>;
  blocks: BlockConfig[];
  elements?: CanvasElement[];
}

export interface TemplateConfig {
  sections: SectionConfig[];
}

export interface StorefrontSettingsV2 {
  theme: ThemeConfig;
  templates: Record<TemplateKey, TemplateConfig>;
  pages?: Record<string, { rawHtml?: string; rawCss?: string }>;
  canvasElements?: any[];
}

export interface SectionSchema {
  type: string;
  label: string;
  icon: string;
  category: "header" | "content" | "products" | "media" | "footer";
  defaultSettings: Record<string, any>;
  settingsSchema: SettingField[];
  allowsBlocks?: boolean;
  defaultBlocks?: BlockConfig[];
  blockSchema?: SettingField[];
  limit?: number;
}

// THIS IS THE FIX: Added "font", "animation", and "icon" to the union
export type SettingField =
  | { key: string; type: "text"; label: string; default?: string }
  | { key: string; type: "textarea"; label: string; default?: string }
  | { key: string; type: "richtext"; label: string; default?: string }
  | { key: string; type: "color"; label: string; default?: string }
  | { key: string; type: "number"; label: string; default?: number; min?: number; max?: number }
  | { key: string; type: "range"; label: string; default?: number; min?: number; max?: number; step?: number }
  | { key: string; type: "select"; label: string; default?: string; options: { label: string; value: string }[] }
  | { key: string; type: "image"; label: string; default?: string }
  | { key: string; type: "url"; label: string; default?: string }
  | { key: string; type: "boolean"; label: string; default?: boolean }
  | { key: string; type: "alignment"; label: string; default?: "left" | "center" | "right" }
  | { key: string; type: "font"; label: string; default?: string }
  | { key: string; type: "animation"; label: string; default?: string }
  | { key: string; type: "icon"; label: string; default?: string };