"use client";
import { useState, useEffect } from "react";

export default function ShopAdmin() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", price: "", sku: "", description: "", imageUrl: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const fetchProducts = () => {
    fetch("/api/shop/admin/products").then(res => res.json()).then(data => {
      if (Array.isArray(data)) setProducts(data);
    });
  };

  useEffect(() => { fetchProducts(); }, []);

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
      fetchProducts();
      alert("Product added successfully!");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this product?")) {
      await fetch(`/api/shop/admin/products?id=${id}`, { method: "DELETE" });
      fetchProducts();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 text-gray-900">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Shop Admin Panel</h1>
        <a href="/shop" target="_blank" className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-gray-800">View Public Shop ↗</a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm col-span-1 h-fit">
          <h2 className="font-semibold text-lg mb-4">Add New Product</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Product Name</label>
              <input required type="text" className="w-full border p-2 rounded mt-1 bg-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Price (PKR)</label>
                <input required type="number" className="w-full border p-2 rounded mt-1 bg-white" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">SKU</label>
                <input type="text" placeholder="Auto-generated" className="w-full border p-2 rounded mt-1 bg-white" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold">Product Image</label>
              <input type="file" accept="image/*" className="w-full border p-2 rounded mt-1 text-sm bg-white" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </div>
            <button disabled={loading} type="submit" className="w-full bg-blue-600 text-white py-3 rounded text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {loading ? "Processing..." : "Save Product"}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm col-span-1 md:col-span-2">
          <h2 className="font-semibold text-lg mb-4">Live Inventory</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400">No products added yet.</td></tr>
                ) : products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><img src={p.imageUrl || "https://placehold.co/100x100"} alt={p.name} className="w-10 h-10 object-cover rounded" /></td>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3">${Number(p.salePrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
