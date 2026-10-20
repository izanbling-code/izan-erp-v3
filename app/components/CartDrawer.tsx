"use client";

import { useCartStore } from "@/app/(storefront)/useCartStore";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";

export default function CartDrawer() {
  const { items, isOpen, toggleCart, updateQuantity, removeItem } = useCartStore();

  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);
  
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Dark Overlay */}
      <div 
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[9998] transition-opacity"
        onClick={toggleCart}
      />

      {/* Slide-out Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Your Cart
          </h2>
          <button onClick={toggleCart} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="text-center text-slate-500 mt-12 flex flex-col items-center gap-3">
              <ShoppingBag className="w-12 h-12 text-slate-200" />
              <p>Your cart is empty.</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 items-center group">
                <div className="relative w-20 h-24 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">{item.name}</h3>
                  <p className="text-teal-600 font-medium text-sm mt-1">Rs. {item.price.toLocaleString("en-US")}</p>
                  
                  {/* Quantity Toggles */}
                  <div className="flex items-center gap-3 mt-3 bg-slate-50 w-fit rounded-full px-2 py-1 border border-slate-100">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:text-teal-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:text-teal-600">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <button onClick={() => removeItem(item.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout */}
        {items.length > 0 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <div className="flex justify-between mb-4 text-sm font-semibold text-slate-900">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toLocaleString("en-US")}</span>
            </div>
            <button className="w-full bg-slate-900 hover:bg-teal-600 text-white font-bold py-4 rounded-xl transition-colors tracking-wide">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}