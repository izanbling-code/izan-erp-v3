import { prisma } from "@/app/lib/prisma";

// This single line stops Vercel from caching the dummy data and forces live updates
export const dynamic = "force-dynamic";

export default async function ShopPage() {
  // Fetch live products straight from the master ERP database
  const products = await prisma.product.findMany({
    where: { type: "GOODS", isActive: true },
    orderBy: { createdAt: "desc" },
  });

  // Automatically switch between live data and fallback dummies
  const displayProducts = products.length > 0 ? products : [
    { id: '1', name: 'Classic Gold Chain', salePrice: 120, imageUrl: 'https://placehold.co/400x400?text=Gold+Chain' },
    { id: '2', name: 'Diamond Stud Earrings', salePrice: 350, imageUrl: 'https://placehold.co/400x400?text=Earrings' },
    { id: '3', name: 'Silver Tennis Bracelet', salePrice: 210, imageUrl: 'https://placehold.co/400x400?text=Bracelet' },
    { id: '4', name: 'Vintage Pearl Ring', salePrice: 180, imageUrl: 'https://placehold.co/400x400?text=Pearl+Ring' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-white">
      <header className="flex justify-between items-center p-8 border-b">
        <h1 className="text-2xl tracking-widest uppercase">Izan Bling</h1>
        <button className="text-sm uppercase tracking-wide">Cart</button>
      </header>

      <main className="flex-grow p-8 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16 mt-8">
          <h2 className="text-4xl font-light mb-4">The Collection</h2>
          <p className="text-gray-500 text-sm">Explore our latest aesthetic arrivals. Minimalist design crafted for maximum elegance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {displayProducts.map(product => (
            <div key={product.id} className="group cursor-pointer">
              <div className="aspect-square bg-gray-100 mb-4 overflow-hidden rounded">
                <img src={product.imageUrl || `https://placehold.co/400x400?text=${product.name}`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <h3 className="text-sm font-semibold">{product.name}</h3>
              <p className="text-xs text-gray-500 mt-1">${Number(product.salePrice).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 border-t pt-16">
           <div>
             <h3 className="text-sm tracking-widest uppercase mb-6">Contact Us</h3>
             <form className="space-y-4">
               <input type="text" placeholder="Name" className="w-full border p-3 text-sm rounded" />
               <input type="email" placeholder="Email" className="w-full border p-3 text-sm rounded" />
               <textarea placeholder="Message" rows={4} className="w-full border p-3 text-sm rounded"></textarea>
               <button className="bg-gray-900 text-white px-6 py-2 text-xs uppercase tracking-widest rounded hover:bg-gray-800">Send Message</button>
             </form>
           </div>
           <div className="text-right">
             <h3 className="text-sm tracking-widest uppercase mb-6">Follow Us</h3>
             <div className="flex flex-col space-y-2 text-sm text-gray-500">
               <a href="#" className="hover:text-gray-900">Instagram</a>
               <a href="#" className="hover:text-gray-900">Pinterest</a>
               <a href="#" className="hover:text-gray-900">Twitter</a>
             </div>
             <p className="text-xs text-gray-400 mt-16">&copy; 2026 Izan Bling. All rights reserved.</p>
           </div>
        </div>
      </main>
    </div>
  );
}
