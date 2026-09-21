"use client";
import { useState, useEffect } from "react";

export default function ShopStorefront() {
  const [items, setItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form States
  const [checkoutData, setCheckoutData] = useState({ name: "", phone: "", address: "", paymentStatus: "Pending", paymentRef: "" });
  const [contactData, setContactData] = useState({ name: "", email: "", message: "" });
  const [contactStatus, setContactStatus] = useState("");

  // Fetch actual items (Fallback to dummy data if API is empty/pending)
  useEffect(() => {
    fetch("/api/shop/admin/items")
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) setItems(data);
        else setItems([
          { id: "1", name: "Classic Gold Chain", price: 120.00, image: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Gold+Chain" },
          { id: "2", name: "Diamond Stud Earrings", price: 350.00, image: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Earrings" },
          { id: "3", name: "Silver Tennis Bracelet", price: 210.00, image: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Bracelet" },
          { id: "4", name: "Vintage Pearl Ring", price: 180.00, image: "https://placehold.co/400x500/f3f4f6/a1a1aa?text=Pearl+Ring" }
        ]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handleCheckoutSubmit = async (e: any) => {
    e.preventDefault();
    await fetch("/api/shop/checkout", {
      method: "POST",
      body: JSON.stringify({ cart, details: checkoutData }),
    });
    setCart([]);
    setIsCheckoutOpen(false);
    alert("Order placed successfully! We will contact you soon.");
  };

  const handleContactSubmit = async (e: any) => {
    e.preventDefault();
    setContactStatus("Sending...");
    await fetch("/api/shop/contact", { method: "POST", body: JSON.stringify(contactData) });
    setContactStatus("Message sent!");
    setContactData({ name: "", email: "", message: "" });
    setTimeout(() => setContactStatus(""), 3000);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-white overflow-y-auto w-screen h-screen m-0 p-0 text-gray-900 font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-widest uppercase">Izan Bling</h1>
          <button onClick={() => setIsCartOpen(true)} className="relative p-2 flex items-center gap-2 hover:opacity-70 transition">
            <span className="text-sm tracking-wide uppercase">Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-black text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl md:text-6xl font-light mb-6 tracking-tight">The Collection</h2>
        <p className="text-gray-500 max-w-xl mx-auto text-lg font-light">Explore our latest aesthetic arrivals. Minimalist design crafted for maximum elegance.</p>
      </section>

      {/* PRODUCT GRID */}
      <main className="max-w-7xl mx-auto px-6 pb-24">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading collection...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">
            {items.map(item => (
              <div key={item.id} className="group cursor-pointer flex flex-col">
                <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden mb-4 rounded-sm">
                  <img src={item.image || "https://placehold.co/400x500/f3f4f6/a1a1aa"} alt={item.name} className="object-cover w-full h-full group-hover:scale-105 transition duration-500" />
                  <button onClick={() => addToCart(item)} className="absolute bottom-0 left-0 w-full bg-black text-white py-3 translate-y-full group-hover:translate-y-0 transition duration-300 text-sm uppercase tracking-wider">
                    Add to Cart
                  </button>
                </div>
                <h3 className="text-sm font-medium">{item.name}</h3>
                <p className="text-sm text-gray-500 mt-1">${parseFloat(item.price).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* FOOTER & CONTACT FORM */}
      <footer className="bg-gray-50 pt-20 pb-10 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <h3 className="text-xl font-light mb-6 uppercase tracking-widest">Contact Us</h3>
            <form onSubmit={handleContactSubmit} className="space-y-4 max-w-md">
              <input required type="text" placeholder="Name" value={contactData.name} onChange={e => setContactData({...contactData, name: e.target.value})} className="w-full border-b border-gray-300 bg-transparent py-3 outline-none focus:border-black transition" />
              <input required type="email" placeholder="Email" value={contactData.email} onChange={e => setContactData({...contactData, email: e.target.value})} className="w-full border-b border-gray-300 bg-transparent py-3 outline-none focus:border-black transition" />
              <textarea required placeholder="Message" value={contactData.message} onChange={e => setContactData({...contactData, message: e.target.value})} className="w-full border-b border-gray-300 bg-transparent py-3 outline-none focus:border-black transition resize-none h-24"></textarea>
              <button type="submit" className="bg-black text-white px-8 py-3 text-sm uppercase tracking-wider hover:bg-gray-800 transition">
                {contactStatus || "Send Message"}
              </button>
            </form>
          </div>
          <div className="flex flex-col justify-between md:items-end">
            <div className="space-y-4 md:text-right">
              <h3 className="text-xl font-light mb-6 uppercase tracking-widest">Follow Us</h3>
              <a href="#" className="block text-gray-500 hover:text-black transition">Instagram</a>
              <a href="#" className="block text-gray-500 hover:text-black transition">Pinterest</a>
              <a href="#" className="block text-gray-500 hover:text-black transition">Twitter</a>
            </div>
            <p className="text-xs text-gray-400 mt-16">&copy; 2026 Izan Bling. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999] flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg uppercase tracking-widest">Your Cart</h2>
              <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-black">Close ✕</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {cart.length === 0 ? (
                <p className="text-gray-500 font-light text-center mt-10">Your cart is empty.</p>
              ) : (
                cart.map((c, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">Qty: {c.qty}</p>
                    </div>
                    <p className="text-sm">${(c.price * c.qty).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 border-t bg-gray-50 space-y-4">
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <button onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }} className="w-full bg-black text-white py-4 uppercase tracking-wider text-sm hover:bg-gray-800 transition">
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999999] flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-lg uppercase tracking-widest">Checkout</h2>
              <button onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>
            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Full Name" className="border border-gray-200 p-3 outline-none focus:border-black w-full text-sm" onChange={e => setCheckoutData({...checkoutData, name: e.target.value})} />
                <input required placeholder="Phone Number" className="border border-gray-200 p-3 outline-none focus:border-black w-full text-sm" onChange={e => setCheckoutData({...checkoutData, phone: e.target.value})} />
              </div>
              <textarea required placeholder="Delivery Address" className="border border-gray-200 p-3 outline-none focus:border-black w-full text-sm resize-none h-20" onChange={e => setCheckoutData({...checkoutData, address: e.target.value})}></textarea>
              
              <div className="border-t pt-5 space-y-4">
                <p className="text-sm uppercase tracking-widest text-gray-500">Payment</p>
                <select className="border border-gray-200 p-3 outline-none focus:border-black w-full text-sm bg-white" onChange={e => setCheckoutData({...checkoutData, paymentStatus: e.target.value})}>
                  <option value="Pending">Pay Later (Pending)</option>
                  <option value="Uploaded Slip">I have a Payment Slip</option>
                </select>
                {checkoutData.paymentStatus === "Uploaded Slip" && (
                  <input required placeholder="Paste Image Link (Google Drive, Imgur, etc.)" className="border border-gray-200 p-3 outline-none focus:border-black w-full text-sm" onChange={e => setCheckoutData({...checkoutData, paymentRef: e.target.value})} />
                )}
              </div>
              <button type="submit" className="w-full bg-black text-white py-4 uppercase tracking-wider text-sm hover:bg-gray-800 transition mt-6">
                Complete Order (${cartTotal.toFixed(2)})
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
