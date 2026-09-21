"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Plus, Minus, Trash2, CheckCircle2, PackageOpen, Send, UploadCloud } from "lucide-react";

function CustomerShopPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Checkout Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [slipRef, setSlipRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");

  useEffect(() => {
    fetch("/api/shop/admin/items")
      .then(res => res.json())
      .then(data => {
        if (data.success) setProducts(data.items);
        setLoading(false);
      });
  }, []);

  const addToCart = (product: any) => {
    setCart(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !address) return alert("Please fill in your name, phone, and address.");
    if (cart.length === 0) return alert("Your cart is empty.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, city, slipRef, cart, totalAmount: subtotal })
      });
      const data = await res.json();
      if (data.success) {
        setOrderSuccess(data.orderNumber);
        setCart([]);
      } else {
        alert("Failed to submit order: " + data.error);
      }
    } catch (err) {
      alert("Network error submitting order.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(val || 0).replace("PKR", "Rs ");
  };

  if (loading) return <div className="min-h-screen bg-[#0B1121] flex items-center justify-center text-slate-400">Loading collection...</div>;

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 font-sans selection:bg-blue-600 selection:text-white">
      
      <header className="sticky top-0 z-40 bg-[#0B1121]/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">IB</div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-wider">Izan Bling</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Official Online Store</p>
          </div>
        </div>

        <button onClick={() => setIsCartOpen(true)} className="relative bg-[#131C2F] border border-slate-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-slate-800 transition-all">
          <ShoppingBag className="w-4 h-4 text-blue-400" />
          <span>Cart</span>
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
              {cart.reduce((s, i) => s + i.qty, 0)}
            </span>
          )}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12 text-center max-w-xl mx-auto">
          <h2 className="text-3xl font-black text-white tracking-tight">Our Collection</h2>
          <p className="text-slate-400 text-sm mt-2">Browse our latest items, add them to your cart, and complete your order with payment verification.</p>
        </div>

        {orderSuccess ? (
          <div className="max-w-md mx-auto bg-[#131C2F] border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-4 my-12">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
            <h3 className="text-2xl font-black text-white">Order Received!</h3>
            <p className="text-slate-400 text-sm">Your order ref is <span className="text-blue-400 font-bold">{orderSuccess}</span>. We have logged your payment slip and will dispatch your items soon.</p>
            <button onClick={() => setOrderSuccess("")} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl w-full">
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(product => (
              <div key={product.id} className="bg-[#131C2F] rounded-3xl border border-slate-800 overflow-hidden flex flex-col group hover:border-slate-600 transition-all shadow-lg">
                <div className="h-52 bg-slate-900 relative overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{product.category}</span>
                  <h3 className="font-bold text-white text-base mt-1 line-clamp-1">{product.name}</h3>
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <span className="font-black text-lg text-emerald-400">{formatCurrency(product.price)}</span>
                    <button onClick={() => addToCart(product)} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-all shadow-md active:scale-95">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#131C2F] border-l border-slate-800 h-full flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-blue-400" /> Cart Summary</h3>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white font-bold p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <PackageOpen className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm font-medium">Your cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-[#0B1121] rounded-2xl border border-slate-800 p-4 flex gap-4 items-center">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                      <p className="text-xs text-emerald-400 font-bold mt-1">{formatCurrency(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-[#131C2F] rounded-xl border border-slate-700 p-1">
                      <button onClick={() => updateQty(item.id, -1)} className="p-1 text-slate-400 hover:text-white"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-bold w-5 text-center text-white">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="p-1 text-slate-400 hover:text-white"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-slate-600 hover:text-rose-400 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-[#0B1121] border-t border-slate-800 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total</span>
                  <span className="text-xl font-black text-white">{formatCurrency(subtotal)}</span>
                </div>

                <form onSubmit={handleCheckout} className="space-y-3 pt-2">
                  <input type="text" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[#131C2F] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
                  <input type="tel" placeholder="Phone Number *" value={phone} onChange={e => setPhone(e.target.value)} required className="w-full bg-[#131C2F] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
                  <input type="text" placeholder="Delivery Address *" value={address} onChange={e => setAddress(e.target.value)} required className="w-full bg-[#131C2F] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
                  <input type="text" placeholder="City *" value={city} onChange={e => setCity(e.target.value)} required className="w-full bg-[#131C2F] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Payment Slip Link / Note (Optional)</label>
                    <input type="text" placeholder="Paste image link of your bank transfer slip" value={slipRef} onChange={e => setSlipRef(e.target.value)} className="w-full bg-[#131C2F] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
                  </div>

                  <button type="submit" disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2">
                    <Send className="w-4 h-4" /> {submitting ? "Sending..." : "Submit Order & Slip"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Viewport Breakout Wrapper to hide ERP Layout
export default function PublicShopWrapper() {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#0B1120] overflow-y-auto w-screen h-screen m-0 p-0 block">
      <CustomerShopPage />
    </div>
  );
}
