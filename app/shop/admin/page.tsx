"use client";

import { useState, useEffect } from "react";
import { Store, ExternalLink, Trash2, UploadCloud, Image as ImageIcon, PlusCircle, AlertCircle } from "lucide-react";

export default function ShopAdmin() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", price: "", sku: "", description: "", imageUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const fetchData = async () => {
    try {
      // Parallel fetch to load both inventory and the company settings configured earlier
      const [prodRes, compRes] = await Promise.all([
        fetch("/api/shop/admin/products"),
        fetch("/api/settings/company")
      ]);
      const prodData = await prodRes.json();
      const compData = await compRes.json();
      
      if (Array.isArray(prodData)) setProducts(prodData);
      if (compData?.company) setCompanySettings(compData.company);
    } catch (e) {
      console.error("Failed to fetch shop data", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleImageUpload = async () => {
    if (!imageFile) return formData.imageUrl;
    const data = new FormData();
    data.append("file", imageFile);
    
    const res = await fetch("/api/shop/upload", { method: "POST", body: data });
    const json = await res.json();
    
    if (json.error) throw new Error(json.error);
    return json.url;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const uploadedUrl = await handleImageUpload();
      
      const res = await fetch("/api/shop/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, imageUrl: uploadedUrl || formData.imageUrl })
      });
      
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setFormData({ name: "", price: "", sku: "", description: "", imageUrl: "" });
      setImageFile(null);
      fetchData();
      alert("Product published to storefront successfully!");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this product from the storefront?")) {
      await fetch(`/api/shop/admin/products?id=${id}`, { method: "DELETE" });
      fetchData();
    }
  };

  // Determine active currency dynamically
  const currency = companySettings?.currency || "PKR";
  const storeName = companySettings?.storeName || "Storefront Management";
  const isShopDisabled = companySettings?.enablePublicShop === false;

  return (
    <div className="space-y-6 relative z-10 w-full pb-10">
      
      {isShopDisabled && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-bold">Your public storefront is currently disabled in Company Settings. Customers cannot view or purchase products.</p>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-6 h-6 text-teal-500" />
            {storeName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Manage your public e-commerce catalog</p>
        </div>
        <a 
          href="/shop" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all"
        >
          View Live Shop <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADD PRODUCT FORM */}
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-teal-500" /> Publish Product
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Product Name *</label>
              <input required type="text" className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Price ({currency}) *</label>
                <input required type="number" min="0" step="0.01" className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">SKU</label>
                <input type="text" placeholder="Auto-generated" className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 transition-colors placeholder-slate-400" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase block mb-1.5">Product Display Image</label>
              <div className="relative border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-teal-500/50 transition-colors text-center group cursor-pointer bg-slate-50 dark:bg-zinc-950/50">
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                <UploadCloud className="w-6 h-6 mx-auto mb-2 text-slate-400 group-hover:text-teal-500 transition-colors" />
                <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  {imageFile ? imageFile.name : "Click or drag image to upload"}
                </p>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-md shadow-teal-500/20 mt-2">
              {loading ? "Publishing..." : "Publish to Storefront"}
            </button>
          </form>
        </div>

        {/* LIVE INVENTORY CATALOG */}
        <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-sm flex flex-col h-[75vh]">
          <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Live Catalog</h2>
            <span className="bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 px-3 py-1 rounded-full text-xs font-bold border border-teal-200 dark:border-teal-500/20">{products.length} Active Items</span>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap"><thead className="sticky top-0 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5 z-10"><tr>
              <th className="p-4 w-16">Visual</th>
              <th className="p-4">Product Name</th>
              <th className="p-4">SKU</th>
              <th className="p-4 text-right">Price</th>
              <th className="p-4 text-center">Actions</th>
            </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {products.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-500 font-medium">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  Your storefront is currently empty.
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-4">
                    <img src={p.imageUrl || p.image || "https://placehold.co/100x100"} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-white/10" />
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                  <td className="p-4 text-slate-500 font-mono text-xs">{p.sku}</td>
                  <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currency} {Number(p.price || p.salePrice).toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(p.id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 mx-auto block">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.6); }
      `}} />
    </div>
  );
}