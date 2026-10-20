"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase"; // Import your Supabase client
import { Plus, Package, Edit, Trash2, X, Loader2, Save } from "lucide-react";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    imageUrl: "",
    salePrice: "",
    compareAtPrice: "",
    isPublished: false,
  });

  // 1. Fetch Products directly from Supabase
  const fetchProducts = async () => {
    setLoading(true);
    
    // Get the company ID first
    const { data: company } = await supabase.from("Company").select("id").limit(1).single();
    if (company) setCompanyId(company.id);

    // Fetch products
    const { data, error } = await supabase
      .from("Product")
      .select("*")
      .order("createdAt", { ascending: false });

    if (!error && data) setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ name: "", sku: "", description: "", imageUrl: "", salePrice: "", compareAtPrice: "", isPublished: false });
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      salePrice: product.salePrice.toString(),
      compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : "",
      isPublished: product.isPublished,
    });
    setIsModalOpen(true);
  };

  // 2. Save Product directly to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return alert("Company not loaded yet.");
    
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        sku: formData.sku || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        description: formData.description,
        imageUrl: formData.imageUrl,
        salePrice: Number(formData.salePrice),
        compareAtPrice: formData.compareAtPrice ? Number(formData.compareAtPrice) : null,
        isPublished: formData.isPublished,
        companyId: companyId,
      };

      if (editingId) {
        // Update
        await supabase.from("Product").update(payload).eq("id", editingId);
      } else {
        // Create
        await supabase.from("Product").insert([payload]);
      }
      
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert("Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  // 3. Delete Product directly from Supabase
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await supabase.from("Product").delete().eq("id", id);
    fetchProducts();
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-teal-500" /> Product Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage your inventory and storefront items.</p>
        </div>
        <button onClick={openNewModal} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-white/5">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Product</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Price</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 relative overflow-hidden shrink-0">
                      {p.imageUrl ? (
                        <Image src={p.imageUrl} alt={p.name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs">No Img</div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-slate-900 dark:text-white block">{p.name}</span>
                      <span className="text-xs text-slate-500 font-mono">{p.sku}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white block">Rs. {Number(p.salePrice).toLocaleString()}</span>
                  {p.compareAtPrice && <span className="text-xs text-slate-400 line-through">Rs. {Number(p.compareAtPrice).toLocaleString()}</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    p.isPublished ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-400"
                  }`}>
                    {p.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-md transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  No products found. Click "Add Product" to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingId ? "Edit Product" : "Add New Product"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Product Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">SKU (Optional)</label>
                  <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="Auto-generated if empty" className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Image URL (Cloudinary)</label>
                <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Sale Price (Rs.)</label>
                  <input required type="number" step="0.01" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Compare At Price (Optional)</label>
                  <input type="number" step="0.01" value={formData.compareAtPrice} onChange={e => setFormData({...formData, compareAtPrice: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="publish" checked={formData.isPublished} onChange={e => setFormData({...formData, isPublished: e.target.checked})} className="w-4 h-4 accent-teal-500" />
                <label htmlFor="publish" className="text-sm text-slate-700 dark:text-zinc-300 font-medium">Publish to storefront immediately</label>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-zinc-400 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}