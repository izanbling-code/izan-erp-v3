import { Fragment } from "react";
import { prisma } from "@/app/lib/prisma";
import ShopNavbar from "@/app/components/ShopNavbar";
import AddToCartButton from "@/app/components/AddToCartButton";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: { companySettings: true },
  });
  if (!company) notFound();

  const product = await prisma.product.findFirst({
    where: {
      id,
      companyId: company.id,
      type: { in: ["PRODUCT", "GOODS"] },
      isActive: true,
      isPublished: true,
    },
  });
  if (!product) notFound();

  const storefront = company.companySettings?.storefront as
    | { pages?: Record<string, { rawHtml?: string; rawCss?: string }> }
    | null;
  const productTemplate = storefront?.pages?.["product-template"];
  const productImage = product.imageUrl || "https://placehold.co/600x600";
  const cartProduct = {
    ...product,
    costPrice: Number(product.costPrice || 0),
    salePrice: Number(product.salePrice || 0),
    salesPrice: Number(product.salesPrice || 0),
    reorderLevel: Number(product.reorderLevel || 0),
  };

  if (productTemplate?.rawHtml?.trim()) {
    const productValues: Record<string, string> = {
      name: product.name,
      description: product.description || "Minimalist aesthetic piece crafted for maximum elegance.",
      price: Number(product.salePrice).toLocaleString(),
      sku: product.sku || "N/A",
      imageUrl: productImage,
    };
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character);
    const renderProductValues = (html: string) =>
      html.replace(/\{\{product\.(name|description|price|sku|imageUrl)\}\}/g, (_placeholder, key: string) =>
        escapeHtml(productValues[key])
      );
    const cartPlaceholder = "{{product.addToCart}}";
    const templateParts = productTemplate.rawHtml.split(cartPlaceholder);

    return (
      <main className="w-full">
        {productTemplate.rawCss && <style dangerouslySetInnerHTML={{ __html: productTemplate.rawCss }} />}
        {templateParts.map((part, index) => (
          <Fragment key={index}>
            <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: renderProductValues(part) }} />
            {index < templateParts.length - 1 && <AddToCartButton product={cartProduct} />}
          </Fragment>
        ))}
        {templateParts.length === 1 && (
          <div className="mx-auto max-w-6xl px-6 py-8">
            <AddToCartButton product={cartProduct} />
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col font-sans text-gray-900">
      <ShopNavbar />
      
      <main className="flex-grow p-8 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
        <div className="bg-gray-50 rounded-lg overflow-hidden border">
           <img src={productImage} alt={product.name} className="w-full h-auto object-contain" />
        </div>
        
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-light mb-2">{product.name}</h1>
          <p className="text-sm text-gray-400 mb-6 uppercase tracking-widest">SKU: {product.sku || "N/A"}</p>
          <p className="text-2xl font-medium mb-8">Rs. {Number(product.salePrice).toLocaleString()}</p>
          
          <div className="border-t border-b py-6 mb-8">
            <h3 className="text-sm tracking-widest uppercase mb-4">Description</h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              {product.description || "Minimalist aesthetic piece crafted for maximum elegance."}
            </p>
          </div>
          
          <AddToCartButton product={cartProduct} />
        </div>
      </main>
    </div>
  );
}
