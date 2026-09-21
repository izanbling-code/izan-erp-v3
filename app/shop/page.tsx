import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import ShopNavbar from "@/app/components/ShopNavbar";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { type: "GOODS", isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const displayProducts = products.length > 0 ? products : [
    { id: '1', name: 'Classic Gold Chain', salePrice: 12000, imageUrl: 'https://placehold.co/400x400?text=Gold+Chain' }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto flex flex-col font-sans text-gray-900">
      <ShopNavbar />

      <main className="flex-grow p-8 max-w-7xl mx-auto w-full flex flex-col">
        <div className="text-center mb-16 mt-8">
          <h2 className="text-4xl font-light mb-4">The Collection</h2>
          <p className="text-gray-500 text-sm">Explore our latest aesthetic arrivals.</p>
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

        {/* FOOTER & CONTACT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 border-t pt-16 mt-auto">
           <div>
             <h3 className="text-sm tracking-widest uppercase mb-6">Contact Us</h3>
             <form className="space-y-4" action="/api/shop/contact" method="POST">
               <input type="text" name="name" placeholder="Name" required className="w-full border p-3 text-sm rounded bg-white" />
               <input type="email" name="email" placeholder="Email" required className="w-full border p-3 text-sm rounded bg-white" />
               <textarea name="message" placeholder="Message" rows={4} required className="w-full border p-3 text-sm rounded bg-white"></textarea>
               <button type="submit" className="bg-gray-900 text-white px-6 py-2 text-xs uppercase tracking-widest rounded hover:bg-gray-800 transition">Send Message</button>
             </form>
           </div>
           <div className="text-right flex flex-col justify-between">
             <div>
               <h3 className="text-sm tracking-widest uppercase mb-6">Follow Us</h3>
               <div className="flex flex-col space-y-2 text-sm text-gray-500">
                 <a href="#" className="hover:text-gray-900 transition">Instagram</a>
               </div>
             </div>
             <p className="text-xs text-gray-400 mt-16">&copy; 2026 Izan Bling.</p>
           </div>
        </div>
      </main>
    </div>
  );
}
