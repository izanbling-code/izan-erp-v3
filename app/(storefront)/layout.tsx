"use client";

import { usePathname } from "next/navigation";
import ShopNavbar from "@/app/components/ShopNavbar";
import CartDrawer from "@/app/components/CartDrawer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if we are currently inside the Shop Admin
  const isAdminRoute = pathname?.startsWith("/shop/admin");

  // If we are in the admin, render ONLY the children (no storefront navbar)
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
        {children}
      </div>
    );
  }

  // Otherwise, render the normal public storefront layout
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 antialiased">
      <ShopNavbar />
      <div className="flex-grow">
        {children}
      </div>
      <CartDrawer />
    </div>
  );
}