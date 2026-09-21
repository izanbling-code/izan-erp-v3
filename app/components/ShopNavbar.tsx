"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ShopNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("CART"); 
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("LATER");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      let slipUrl = "";
      if (paymentMethod === "SLIP" && slipFile) {
        const formData = new FormData();
        formData.append("file", slipFile);
        const uploadRes = await fetch("/api/shop/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error);
        slipUrl = uploadData.url;
      }

      const orderData = {
        customer: { name: e.target.fullName.value, phone: e.target.phone.value, address: e.target.address.value },
        items: cart,
        paymentMethod,
        paymentSlipUrl: slipUrl,
        total: cartTotal
      };
      
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      alert("Order successfully placed! We will contact you soon.");
      setCart([]);
      localStorage.removeItem("izan_cart");
      window.dispatchEvent(new Event("cart-updated"));
      setIsOpen(false);
      setView("CART");
    } catch (error: any) {
      alert(`Checkout failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <header className="flex justify-between items-center p-8 border-b bg-white relative z-50">
        <Link href="/shop" className="text-2xl tracking-widest uppercase hover:opacity-70 transition">Izan Bling</Link>
        <button onClick={() => setIsOpen(true)} className="text-sm uppercase tracking-wide hover:text-gray-500 transition">
          Cart ({cart.length})
        </button>
      </header>

      {/* UPDATED: Added backdrop-blur-md and bg-black/30 for frosted glass effect */}
      {isOpen && <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-[150] transition-all" onClick={() => setIsOpen(false)}></div>}

      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[200] transform transition-transform duration-300 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg uppercase tracking-widest">{view === "CART" ? "Your Cart" : "Checkout"}</h2>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-black text-2xl">&times;</button>
        </div>

        <div className="flex-grow overflow-y-auto p-6">
          {view === "CART" ? (
            cart.length === 0 ? (
              <p className="text-gray-500 text-sm text-center mt-10">Your cart is empty.</p>
            ) : (
              <div className="space-y-6">
                {cart.map((item, i) => (
                  <div key={i} className="flex gap-4 border-b pb-4">
                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    <div className="flex-grow">
                      <h4 className="text-sm font-medium">{item.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">Rs. {Number(item.salePrice).toLocaleString()}</p>
                    </div>
                    <button onClick={() => removeFromCart(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form id="checkout-form" onSubmit={handleCheckout} className="space-y-4">
              <input name="fullName" required type="text" placeholder="Full Name" className="w-full border p-3 text-sm rounded bg-white" />
              <input name="phone" required type="text" placeholder="Phone Number" className="w-full border p-3 text-sm rounded bg-white" />
              <textarea name="address" required placeholder="Delivery Address" rows={3} className="w-full border p-3 text-sm rounded bg-white"></textarea>
              <div className="border-t pt-4 mt-4">
                <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border p-3 text-sm rounded mb-4 bg-white">
                  <option value="LATER">Pay Later (Cash on Delivery)</option>
                  <option value="SLIP">Bank Transfer (Upload Slip)</option>
                </select>
                {paymentMethod === "SLIP" && (
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 mb-1 block">Upload Payment Slip</label>
                    <input required type="file" accept="image/*" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} className="w-full border p-2 text-sm rounded bg-white" />
                  </div>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between mb-4">
            <span className="uppercase text-sm font-bold">Total</span>
            <span className="font-medium">Rs. {cartTotal.toLocaleString()}</span>
          </div>
          {view === "CART" ? (
            <button disabled={cart.length === 0} onClick={() => setView("CHECKOUT")} className="w-full bg-black text-white py-3 uppercase tracking-widest text-sm rounded disabled:opacity-50">
              Proceed to Checkout
            </button>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setView("CART")} className="w-1/3 border border-black text-black py-3 uppercase tracking-widest text-xs rounded hover:bg-gray-100">Back</button>
              <button disabled={isProcessing} type="submit" form="checkout-form" className="w-2/3 bg-black text-white py-3 uppercase tracking-widest text-sm rounded disabled:opacity-50">
                {isProcessing ? "Processing..." : "Place Order"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
