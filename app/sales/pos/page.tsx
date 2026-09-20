"use client";

import { useState, useMemo } from "react";

// Mock data to show you exactly how it will look at the stall!
const MOCK_PRODUCTS = [
  { id: "1", name: "18k Gold Plated Snake Chain", category: "Stainless Steel", price: 2500, stock: 15, color: "#fef08a" },
  { id: "2", name: "Silver Minimalist Cuff", category: "Stainless Steel", price: 1800, stock: 8, color: "#e5e7eb" },
  { id: "3", name: "Rose Gold Pendant", category: "Stainless Steel", price: 2200, stock: 12, color: "#fecdd3" },
  { id: "4", name: "Premium Silk Scrunchie Set", category: "Hair Accessories", price: 800, stock: 30, color: "#fbcfe8" },
  { id: "5", name: "Tortoise Shell Claw Clip", category: "Hair Accessories", price: 600, stock: 20, color: "#fed7aa" },
  { id: "6", name: "Pearl Embellished Pins", category: "Hair Accessories", price: 500, stock: 25, color: "#e0e7ff" },
  { id: "7", name: "Kids Butterfly Clip Set", category: "Kids Collection", price: 400, stock: 40, color: "#c7d2fe" },
  { id: "8", name: "Mini Charm Bracelet", category: "Kids Collection", price: 550, stock: 15, color: "#bfdbfe" },
];

const CATEGORIES = ["All", "Stainless Steel", "Hair Accessories", "Kids Collection"];

export default function PointOfSale() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, search]);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const total = subtotal;

  function addToCart(product: any) {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }

  function adjustQty(id: string, delta: number) {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(item => item.qty > 0));
  }

  async function handleCheckout() {
    if (cart.length === 0) return;
    
    setIsProcessing(true);
    // Simulate API delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));
    
    alert(`Success! Rs ${total.toLocaleString()} paid via ${paymentMethod}.`);
    
    // Clear cart for the next customer in line
    setCart([]);
    setIsProcessing(false);
  }

  return (
    <div className="erp-page" style={{ padding: 0, height: "calc(100vh - 40px)", overflow: "hidden" }}>
      
      {/* Top Navigation Bar */}
      <div style={{ background: "#111827", color: "white", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "#f43f5e", color: "white", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", letterSpacing: "1px" }}>POP-UP MODE</div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Izan Bling POS</h1>
        </div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#9ca3af" }}>
          Terminal: <span style={{ color: "white" }}>PNCA Stall 01</span>
        </div>
      </div>

      {/* Main POS Layout */}
      <div style={{ display: "flex", height: "calc(100% - 60px)" }}>
        
        {/* LEFT PANE: Product Grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f9fafb" }}>
          
          {/* Search & Filters */}
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb", background: "white" }}>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "16px", outline: "none", marginBottom: "16px" }}
            />
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: "8px 16px", borderRadius: "20px", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                    fontWeight: 600, fontSize: "13px", transition: "all 0.2s",
                    background: activeCategory === cat ? "#111827" : "#f3f4f6",
                    color: activeCategory === cat ? "white" : "#4b5563"
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px" }}>
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  style={{
                    background: "white", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px",
                    textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: "12px",
                    transition: "transform 0.1s, boxShadow 0.1s",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.97)"}
                  onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  <div style={{ width: "100%", height: "80px", background: product.color, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "rgba(0,0,0,0.2)" }}>
                    {product.category === "Stainless Steel" ? "✨" : product.category === "Hair Accessories" ? "🎀" : "🧸"}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>{product.category}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: "1.2", marginBottom: "6px" }}>{product.name}</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#059669" }}>Rs {product.price.toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANE: Cart & Checkout */}
        <div style={{ width: "380px", background: "white", borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", boxShadow: "-4px 0 15px rgba(0,0,0,0.03)", zIndex: 10 }}>
          
          {/* Customer Info (Default Walk-in) */}
          <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: "6px" }}>Current Customer</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d1d5db" }}>
              <span style={{ fontSize: "18px" }}>👤</span>
              <span style={{ fontWeight: 600, color: "#111827" }}>Walk-in Customer</span>
            </div>
          </div>

          {/* Cart Items */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {cart.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af", textAlign: "center" }}>
                <span style={{ fontSize: "40px", marginBottom: "10px" }}>🛒</span>
                <p style={{ margin: 0, fontWeight: 600 }}>Cart is empty</p>
                <p style={{ margin: "4px 0 0", fontSize: "13px" }}>Tap products to add them to the order.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{item.name}</div>
                      <div style={{ fontSize: "13px", color: "#6b7280" }}>Rs {item.price.toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f3f4f6", padding: "4px", borderRadius: "8px" }}>
                      <button onClick={() => adjustQty(item.id, -1)} style={{ width: "28px", height: "28px", border: "none", background: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", color: "#374151" }}>-</button>
                      <span style={{ fontSize: "14px", fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{item.qty}</span>
                      <button onClick={() => adjustQty(item.id, 1)} style={{ width: "28px", height: "28px", border: "none", background: "white", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", color: "#374151" }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Section */}
          <div style={{ padding: "20px", borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
            
            {/* Payment Methods */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              <button 
                onClick={() => setPaymentMethod("Cash")}
                style={{ padding: "12px", border: "2px solid", borderColor: paymentMethod === "Cash" ? "#059669" : "#e5e7eb", background: paymentMethod === "Cash" ? "#ecfdf5" : "white", borderRadius: "8px", fontWeight: 700, color: paymentMethod === "Cash" ? "#065f46" : "#4b5563", cursor: "pointer", transition: "all 0.1s" }}
              >💵 Cash</button>
              <button 
                onClick={() => setPaymentMethod("EasyPaisa/Card")}
                style={{ padding: "12px", border: "2px solid", borderColor: paymentMethod === "EasyPaisa/Card" ? "#3b82f6" : "#e5e7eb", background: paymentMethod === "EasyPaisa/Card" ? "#eff6ff" : "white", borderRadius: "8px", fontWeight: 700, color: paymentMethod === "EasyPaisa/Card" ? "#1e40af" : "#4b5563", cursor: "pointer", transition: "all 0.1s" }}
              >💳 Transfer</button>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <span style={{ fontSize: "18px", fontWeight: 700, color: "#374151" }}>Total Due</span>
              <span style={{ fontSize: "28px", fontWeight: 800, color: "#111827" }}>Rs {total.toLocaleString()}</span>
            </div>

            {/* Pay Button */}
            <button 
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              style={{ 
                width: "100%", padding: "18px", border: "none", borderRadius: "10px", fontSize: "18px", fontWeight: 800, cursor: cart.length === 0 ? "not-allowed" : "pointer",
                background: cart.length === 0 ? "#d1d5db" : "#111827", color: "white", transition: "all 0.2s"
              }}
            >
              {isProcessing ? "Processing..." : `Checkout Rs ${total.toLocaleString()}`}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
