import { prisma } from "@/app/lib/prisma";
import { notFound } from "next/navigation";
import ShopNavbar from "@/app/components/ShopNavbar";
import AddToCartButton from "@/app/components/AddToCartButton";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: { id: string } }) {
  let product = null;

  if (["1", "2", "3", "4"].includes(params.id)) {
    const dummies = [
      { id: '1', name: 'Classic Gold Chain', sku: 'DUMMY-01', salePrice: 12000, description: 'A beautiful classic gold chain.', imageUrl: 'https://placehold.co/600x600?text=Gold+Chain' },
      { id: '2', name: 'Diamond Stud Earrings', sku: 'DUMMY-02', salePrice: 35000, description: 'Elegant diamond stud earrings.', imageUrl: 'https://placehold.co/600x600?text=Earrings' },
      { id: '3', name: 'Silver Tennis Bracelet', sku: 'DUMMY-03', salePrice: 21000, description: 'A sleek silver tennis bracelet.', imageUrl: 'https://placehold.co/600x600?text=Bracelet' },
      { id: '4', name: 'Vintage Pearl Ring', sku: 'DUMMY-04', salePrice: 18000, description: 'A stunning vintage pearl ring.', imageUrl: 'https://placehold.co/600x600?text=Pearl+Ring' },
    ];
    product = dummies.find(d => d.id === params.id);
  } else {
    try {
      product = await prisma.product.findUnique({ where: { id: params.id } });
    } catch (error) {
      return notFound();
    }
  }

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
          <p className="text-sm text-gray-400 mb-6 uppercase tracking-widest">SKU: {product.sku || "N/A"}</p>
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
