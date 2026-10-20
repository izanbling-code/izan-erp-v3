"use client";

import { useState, useEffect } from "react";
import { Network, Plus, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch funnels matching your API structure
  const fetchFunnels = async () => {
    try {
      const res = await fetch("/api/shop/admin/funnels");
      const data = await res.json();
      // Your API returns the array directly, so we just set data
      if (Array.isArray(data)) {
        setFunnels(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFunnels(); }, []);

  const createFunnel = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/shop/admin/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Welcome Quiz", description: "Custom funnel" })
      });
      const json = await res.json();
      if (json.success) {
        await fetchFunnels(); // Refresh list if successful
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-teal-500" /> Guided Funnels
          </h1>
          <p className="text-sm text-slate-500 mt-1">Build visual quizzes to help customers find the right products.</p>
        </div>
        <button 
          onClick={createFunnel} 
          disabled={creating}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? "Creating..." : "Create Funnel"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {funnels.map((funnel) => (
          <div key={funnel.id} className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 relative group">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center mb-4">
              <Network className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{funnel.title}</h3>
            <p className="text-sm text-slate-500 mt-2 mb-4">{funnel.description || "No description"}</p>
            
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
              {/* Point this to your actual funnel editor route */}
              <Link href={`/shop/admin/funnels/${funnel.id}`} className="text-sm font-semibold text-teal-500 hover:text-teal-600 flex items-center gap-1">
                Edit Flow <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
        {funnels.length === 0 && !loading && (
           <div className="col-span-full py-12 text-center text-slate-500">No funnels created yet. Click "Create Funnel" to start.</div>
        )}
      </div>
    </div>
  );
}