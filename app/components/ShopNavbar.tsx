"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ICON_MAP } from "@/app/(storefront)/shop/admin/design/canvas/ElementIcons";

export default function ShopNavbar({ section, storeName }: { section?: any; storeName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("CART"); 
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("LATER");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const s = section?.settings || {};
  const bgColor = s.bgColor || "#ffffff";
  const textColor = s.textColor || "#0f172a";
  const paddingY = s.paddingY || 24; 
  const displayName = s.brandName || storeName || "IZAN BLING";
  const blocks = section?.blocks || [];

  // Check if any block is specifically a cart block to auto-open drawer
  useEffect(() => {
    const cartBtn = document.getElementById('navbar-cart-btn');
    if (cartBtn) {
      cartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setIsOpen(true);
      });
    }
  }, []);

  const loadCart = () => {
    const saved = localStorage.getItem("izan_cart");
    if (saved) setCart(JSON.parse(saved));
  };

  useEffect(() => {
    loadCart();
    window.addEventListener("cart-updated", loadCart);
    return () => window.removeEventListener("cart-updated", loadCart);
  }, []);

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
    localStorage.setItem("izan_cart", JSON.stringify(newCart));
    window.dispatchEvent(new Event("cart-updated"));
  };

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.salePrice), 0);

  const handleCheckout = async (e: any) => {
    // (Keep your exact same checkout logic here)
    e.preventDefault();
    setIsProcessing(true);
    try {
        // ... Keep all your checkout logic ...
    } catch (error: any) {
      alert(`Checkout failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <header 
        style={{ backgroundColor: bgColor, color: textColor, paddingTop: paddingY, paddingBottom: paddingY }}
        className="flex justify-between items-center px-8 border-b relative z-10 transition-colors"
      >
        {/* LEFT: LOGO */}
        <Link href="/shop" className="text-2xl tracking-widest uppercase hover:opacity-70 transition">
          {displayName}
        </Link>

        {/* CENTER & RIGHT: DYNAMIC BLOCKS */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {blocks.map((block: any) => {
            const Icon = block.settings.icon ? ICON_MAP[block.settings.icon] : null;
            const isCart = block.settings.icon === "ShoppingCart" || block.settings.label === "Cart";

            return (
              <Link 
                key={block.id} 
                href={block.settings.href || "#"} 
                id={isCart ? "navbar-cart-btn" : undefined}
                className="flex items-center gap-2 hover:opacity-60 transition-opacity relative"
              >
                {Icon && <Icon className="w-5 h-5" />}
                {block.settings.label && <span>{block.settings.label}</span>}
                
                {/* Cart Badge */}
                {isCart && cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                    {cart.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* 
        YOUR ENTIRE CART DRAWER CODE REMAINS EXACTLY THE SAME 
        (Just copy-paste your existing cart drawer here)
      */}
      {isOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[150] transition-all" onClick={() => setIsOpen(false)}></div>}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[200] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
          {/* ... Your entire Cart Drawer UI ... */}
      </div>
    </>
  );
}