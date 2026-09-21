import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return notFound();

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col font-sans text-gray-900">
      <header className="flex justify-between items-center p-8 border-b">
        <Link href="/shop" className="text-2xl tracking-widest uppercase hover:opacity-70 transition">Izan Bling</Link>
        <button className="text-sm uppercase tracking-wide">Cart</button>
      </header>
      
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
              {product.description || "Minimalist aesthetic piece crafted for maximum elegance. A perfect addition to your collection."}
            </p>
          </div>
          
          <button className="bg-gray-900 text-white py-4 px-8 uppercase tracking-widest text-sm hover:bg-gray-800 transition rounded shadow-lg">
            Add to Cart
          </button>
        </div>
      </main>
    </div>
  );
}
