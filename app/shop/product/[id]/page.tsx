import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import ShopNavbar from "@/app/components/ShopNavbar";
import AddToCartButton from "@/app/components/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return notFound();

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col font-sans text-gray-900">
      <ShopNavbar />
      
      <main className="flex-grow p-8 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
        <div className="bg-gray-50 rounded-lg overflow-hidden border">
           <img src={product.imageUrl || "https://placehold.co/600x600"} alt={product.name} className="w-full h-auto object-contain" />
        </div>
        
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-light mb-2">{product.name}</h1>
          <p className="text-sm text-gray-400 mb-6 uppercase tracking-widest">SKU: {product.sku}</p>
          <p className="text-2xl font-medium mb-8">Rs. {Number(product.salePrice).toLocaleString()}</p>
          
          <div className="border-t border-b py-6 mb-8">
            <h3 className="text-sm tracking-widest uppercase mb-4">Description</h3>
            <p className="text-gray-600 leading-relaxed text-sm">
              {product.description || "Minimalist aesthetic piece crafted for maximum elegance."}
            </p>
          </div>
          
          <AddToCartButton product={product} />
        </div>
      </main>
    </div>
  );
}
