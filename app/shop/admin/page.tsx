"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Save, Package, Image as ImageIcon, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ShopAdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("General");
  const [imageUrl, setImageUrl] = useState("");
  const [stock, setStock] = useState("10");

  const fetchItems = async () => {
    setLoading(true);
    const res = await fetch("/api/shop/admin/items");
    const data = await res.json();
    if (data.success) setItems(data.items);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return alert("Name and price are required.");

    const res = await fetch("/api/shop/admin/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price), category, image: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500", stock: Number(stock) })
    });
    
    if (res.ok) {
      setName(""); setPrice(""); setImageUrl("");
      fetchItems();
    } else {
      alert("Failed to add item");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    await fetch(`/api/shop/admin/items?id=${id}`, { method: "DELETE" });
    fetchItems();
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <Link href="/dashboard" className="text-xs text-blue-400 hover:underline flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to ERP Dashboard
            </Link>
            <h1 className="text-3xl font-black text-white">Public Store Manager</h1>
            <p className="text-sm text-slate-400">Add products, upload pictures, and manage what customers see online.</p>
          </div>
          <Link href="/shop" target="_blank" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all">
            View Live Public Shop ↗
          </Link>
        </div>

        {/* Add Item Form */}
        <form onSubmit={handleAddItem} className="bg-[#131C2F] border border-slate-800 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-6 gap-4 items-end shadow-xl">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Item Name</label>
            <input type="text" placeholder="e.g. Luxury Watch" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[#0B1121] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Price (Rs)</label>
            <input type="number" placeholder="2500" value={price} onChange={e => setPrice(e.target.value)} required className="w-full bg-[#0B1121] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Category</label>
            <input type="text" placeholder="Accessories" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[#0B1121] border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Image URL (Picture Link)</label>
            <input type="url" placeholder="https://image-link.com/photo.jpg" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-[#0B1121] border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div className="md:col-span-6 flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-lg transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Item to Public Catalog
            </button>
          </div>
        </form>

        {/* Items List */}
        <div className="bg-[#131C2F] border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4">Active Online Items ({items.length})</h3>
          {loading ? (
            <p className="text-slate-500 text-center py-8">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No online items found. Add one above!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id} className="bg-[#0B1121] border border-slate-800 rounded-2xl p-4 flex gap-4 items-center">
                  <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-slate-800" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                    <p className="text-xs text-emerald-400 font-bold mt-1">Rs {item.price}</p>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">{item.category}</span>
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-rose-400 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}