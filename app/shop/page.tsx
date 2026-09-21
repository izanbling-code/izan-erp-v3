import { prisma } from "@/app/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { type: "GOODS", isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const displayProducts = products.length > 0 ? products : [
    { id: '1', name: 'Classic Gold Chain', salePrice: 12000, imageUrl: 'https://placehold.co/400x400?text=Gold+Chain' },
    { id: '2', name: 'Diamond Stud Earrings', salePrice: 35000, imageUrl: 'https://placehold.co/400x400?text=Earrings' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col font-sans text-gray-900">
      <header className="flex justify-between items-center p-8 border-b">
        <Link href="/shop" className="text-2xl tracking-widest uppercase">Izan Bling</Link>
        <button className="text-sm uppercase tracking-wide">Cart</button>
      </header>

      <main className="flex-grow p-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16 mt-8">
          <h2 className="text-4xl font-light mb-4">The Collection</h2>
          <p className="text-gray-500 text-sm">Explore our latest aesthetic arrivals. Minimalist design crafted for maximum elegance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {displayProducts.map(product => (
            <Link href={`/shop/product/${product.id}`} key={product.id} className="group cursor-pointer block">
              <div className="aspect-square bg-gray-100 mb-4 overflow-hidden rounded">
                <img src={product.imageUrl || `https://placehold.co/400x400?text=${product.name}`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <h3 className="text-sm font-semibold">{product.name}</h3>
              <p className="text-xs text-gray-500 mt-1">Rs. {Number(product.salePrice).toLocaleString()}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
