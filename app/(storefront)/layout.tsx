// app/(storefront)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import ShopNavbar from "@/app/components/ShopNavbar";
import CartDrawer from "@/app/components/CartDrawer";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  const isAdminRoute = pathname?.startsWith("/shop/admin");
  const isHomePage = pathname === "/shop";

  // When in the admin panel, DO NOT wrap it in ANY divs or margins.
  // Just return the raw children so ShopAdminLayout can take over.
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // This part is only for the public storefront
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-slate-900 antialiased">
      {!isHomePage && <ShopNavbar />} 
      <div className="flex-grow">
        {children}
      </div>
      <CartDrawer />
    </div>
  );
}