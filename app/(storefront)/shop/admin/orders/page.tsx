"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Search, RefreshCw, ExternalLink } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchOrders = async () => {
    try {
      // Replace this with your actual API endpoint that fetches orders
      const res = await fetch("/api/shop/admin/orders"); 
      const json = await res.json();
      if (json.ok) setOrders(json.data);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Live Courier Sync Function
  const syncCourierStatus = async () => {
    setSyncing(true);
    try {
      // Hit your backend route that talks to TRAX / Courier API
      await fetch("/api/couriers/reconcile", { method: "POST" });
      await fetchOrders(); // Refresh the table with new statuses
    } catch (err) {
      console.error("Courier sync failed", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-teal-500" /> Orders & Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track customer purchases and sync live courier statuses.</p>
        </div>
        <button 
          onClick={syncCourierStatus}
          disabled={syncing}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 dark:text-slate-900 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing with Courier..." : "Sync Courier Status"}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-zinc-950/50">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search order or tracking #..." className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:border-teal-500 dark:text-white" />
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/5">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Order #</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Courier Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-6 py-4 font-mono text-sm text-slate-900 dark:text-white">{o.orderNumber}</td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-400">{o.customer?.name || "Guest"}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">Rs. {Number(o.totalAmount).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    o.status === 'DELIVERED' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                    o.status === 'DISPATCHED' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" :
                    "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-400"
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {o.bookingNumber ? (
                    <a href={`https://trax.pk/tracking?tracking=${o.bookingNumber}`} target="_blank" className="text-teal-500 hover:text-teal-600 text-sm font-semibold flex items-center gap-1">
                      {o.bookingNumber} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">No tracking</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}