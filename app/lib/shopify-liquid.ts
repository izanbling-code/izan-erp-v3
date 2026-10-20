export const SHOPIFY_LIQUID_MESSAGE =
  "This is Shopify Liquid theme code, not standalone HTML. Liquid tags, Shopify sections, theme settings, and assets require Shopify's renderer, which this editor does not provide. Import rendered/static HTML and CSS instead; Liquid templates must be converted to regular HTML/CSS first.";

export function containsShopifyLiquid(source: string) {
  const normalized = source
    .replace(/&lbrace;|&#123;|&#x0*7b;/gi, "{")
    .replace(/&rbrace;|&#125;|&#x0*7d;/gi, "}")
    .replace(
      /\{\{\s*(?:product\.(?:name|description|price|sku|imageUrl|addToCart)|store\.productGrid)\s*\}\}/gi,
      ""
    );

  return /\{%[-]?[\s\S]*?[-]?%\}|\{\{[-]?\s*[\s\S]*?[-]?\}\}/.test(normalized);
}
