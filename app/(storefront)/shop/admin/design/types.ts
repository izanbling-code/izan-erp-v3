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

export interface SectionConfig {
  id: string;
  type: string;
  name: string;
  disabled?: boolean;
  settings: Record<string, any>;
  blocks: BlockConfig[];
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
  | { key: string; type: "alignment"; label: string; default?: "left" | "center" | "right" };