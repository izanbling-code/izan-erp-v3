"use client";

import { useState, useEffect } from "react";
import { Tag, Plus, Trash2, Loader2, X } from "lucide-react";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ code: "", type: "PERCENTAGE", value: "" });
  const [saving, setSaving] = useState(false);

  const fetchDiscounts = async () => {
    const res = await fetch("/api/shop/admin/discounts");
    const json = await res.json();
    if (json.ok) setDiscounts(json.data);
    setLoading(false);
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/shop/admin/discounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    setSaving(false);
    setIsModalOpen(false);
    setFormData({ code: "", type: "PERCENTAGE", value: "" });
    fetchDiscounts();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-teal-500" /> Discounts
          </h1>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors">
          <Plus className="w-4 h-4" /> Create Discount
        </button>
      </div>

      {discounts.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Code</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Value</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {discounts.map(d => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-6 py-4 font-mono font-bold text-teal-600 dark:text-teal-400">{d.code}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                    {d.type === "PERCENTAGE" ? `${d.value}%` : `Rs. ${d.value}`} OFF
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 p-12 text-center">
          <Tag className="w-12 h-12 text-slate-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No discounts active</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Create a discount code to boost your sales.</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-white/5">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Discount</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Discount Code</label>
                <input required type="text" placeholder="e.g. SUMMER20" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500">
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Value</label>
                  <input required type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500" />
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full mt-4 bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Discount"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}