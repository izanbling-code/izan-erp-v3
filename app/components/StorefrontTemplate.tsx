import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import AddToCartButton from "@/app/components/AddToCartButton";
import RawHtml from "@/app/components/RawHtml";

const PRODUCT_GRID_TOKEN = /<storefront-product-grid\b[^>]*>[\s\S]*?<\/storefront-product-grid>/gi;

/**
 * GrapesJS exports a full HTML document (<html><head><body id="...">).
 * We strip these wrappers so the raw HTML can be injected inline.
 */
function stripDocumentWrapper(html: string): string {
  if (!html) return "";
  return html
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<\/?head[^>]*>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")
    .trim();
}

type StorefrontProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  salePrice: number;
  compareAtPrice: number | null;
};

type StorefrontTemplateProps = {
  html: string;
  css?: string;
  products?: StorefrontProduct[];
};

export default function StorefrontTemplate({
  html,
  css,
  products = [],
}: StorefrontTemplateProps) {
  const cleanedHtml = stripDocumentWrapper(html);

  const sections = cleanedHtml
    .replace(PRODUCT_GRID_TOKEN, "{{store.productGrid}}")
    .split("{{store.productGrid}}");

  return (
    <main className="w-full">
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}

      {sections.map((section, index) => (
        <Fragment key={index}>
          {section.trim() && (
            <RawHtml html={section} style={{ display: "contents" }} />
          )}

          {index < sections.length - 1 && (
            <section className="mx-auto w-full max-w-7xl px-6 py-12 md:px-8 md:py-16">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => {
                  const imageUrl =
                    product.imageUrl ||
                    `https://placehold.co/600x800?text=${encodeURIComponent(product.name)}`;
                  const onSale =
                    product.compareAtPrice !== null &&
                    product.compareAtPrice > product.salePrice;

                  return (
                    <article key={product.id} className="group flex flex-col">
                      <Link
                        href={`/shop/product/${product.id}`}
                        className="relative mb-4 block aspect-[4/5] overflow-hidden rounded-xl bg-slate-100"
                      >
                        {onSale && (
                          <span className="absolute left-3 top-3 z-10 rounded bg-rose-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                            Sale
                          </span>
                        )}
                        <Image
                          src={imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </Link>
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/shop/product/${product.id}`}
                          className="min-w-0"
                        >
                          <h3 className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-teal-700">
                            {product.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              Rs. {product.salePrice.toLocaleString("en-US")}
                            </span>
                            {onSale && (
                              <span className="text-xs text-slate-400 line-through">
                                Rs.{" "}
                                {product.compareAtPrice?.toLocaleString("en-US")}
                              </span>
                            )}
                          </div>
                        </Link>
                        <AddToCartButton
                          product={{
                            id: product.id,
                            name: product.name,
                            salePrice: product.salePrice,
                            imageUrl,
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
                {products.length === 0 && (
                  <p className="col-span-full py-12 text-center text-sm text-slate-500">
                    Products will appear here once they are published to your store.
                  </p>
                )}
              </div>
            </section>
          )}
        </Fragment>
      ))}
    </main>
  );
}