"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Box,
  RefreshCw,
  Warehouse,
  ArrowUpRight,
  AlertTriangle,
  Package,
  Plus,
  Scale,
  Edit3,
  Trash2,
  CheckCircle2,
  X,
} from "lucide-react";

const modules = [
  {
    title: "Products Catalog",
    description: "Create and manage products, SKU pricing, categories, brands, and GL account mappings.",
    href: "/inventory/products",
    code: "PRD",
    icon: Box,
    accent:
      "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
  },
  {
    title: "Stock Adjustments & Reclassification",
    description: "Record damaged or lost stock, or move quantities between mixed items with balanced GL entries.",
    href: "/inventory/stock",
    code: "ADJ",
    icon: Scale,
    accent:
      "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
  },
  {
    title: "Stock Movements Ledger",
    description: "Audit all inventory receipts, sales dispatches, repackaging allocations, and adjustments.",
    href: "/inventory/movements",
    code: "MOV",
    icon: RefreshCw,
    accent:
      "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
  },
];

export default function InventoryPage() {
  const { formatAmount, currency } = useERPConfig();

  const [companyId, setCompanyId] = useState("001");
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    activeProducts: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    activeWarehouses: 0,
    totalValuation: 0,
  });

  // Built-in Warehouse Modal State
  const [showWhModal, setShowWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState<any | null>(null);
  const [savingWh, setSavingWh] = useState(false);
  const [whForm, setWhForm] = useState({
    code: "",
    name: "",
    location: "",
    isActive: true,
  });

  async function loadInventoryData() {
    try {
      setLoading(true);
      const { data: comp } = await supabase.from("Company").select("id").limit(1).maybeSingle();
      if (comp?.id) setCompanyId(comp.id);

      const [prodRes, stockRes, whRes] = await Promise.all([
        supabase.from("Product").select("id, isActive, reorderLevel, costPrice"),
        supabase.from("Stock").select("productId, warehouseId, quantity, averageCost"),
        supabase.from("Warehouse").select("*").order("createdAt", { ascending: true }),
      ]);

      const products = prodRes.data || [];
      const stocks = stockRes.data || [];
      const whList = whRes.data || [];

      setWarehouses(whList);

      const activeProducts = products.filter((p: any) => p.isActive !== false).length;
      const activeWarehouses = whList.filter((w: any) => w.isActive !== false).length;

      const totalStockUnits = stocks.reduce((sum: number, s: any) => sum + Number(s.quantity || 0), 0);
      const totalValuation = stocks.reduce(
        (sum: number, s: any) => sum + Number(s.quantity || 0) * Number(s.averageCost || 0),
        0
      );

      const stockByProduct = new Map<string, number>();
      stocks.forEach((s: any) => {
        const current = stockByProduct.get(s.productId) || 0;
        stockByProduct.set(s.productId, current + Number(s.quantity || 0));
      });

      const lowStockCount = products.filter((p: any) => {
        if (p.isActive === false) return false;
        const qty = stockByProduct.get(p.id) || 0;
        const reorder = Number(p.reorderLevel || 0);
        return qty <= reorder;
      }).length;

      setMetrics({
        activeProducts,
        totalStockUnits,
        lowStockCount,
        activeWarehouses,
        totalValuation,
      });
    } catch (err) {
      console.error("Failed to load inventory metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventoryData();
  }, []);

  function openNewWarehouse() {
    setEditingWh(null);
    setWhForm({
      code: `WH-${String(warehouses.length + 1).padStart(2, "0")}`,
      name: "",
      location: "",
      isActive: true,
    });
    setShowWhModal(true);
  }

  function openEditWarehouse(wh: any) {
    setEditingWh(wh);
    setWhForm({
      code: wh.code || "",
      name: wh.name || "",
      location: wh.location || wh.address || "",
      isActive: wh.isActive !== false,
    });
    setShowWhModal(true);
  }

  async function handleSaveWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!whForm.name || !whForm.code) {
      toast.error("Warehouse Code and Name are required.");
      return;
    }

    setSavingWh(true);
    try {
      if (editingWh) {
        const { error } = await supabase
          .from("Warehouse")
          .update({
            code: whForm.code,
            name: whForm.name,
            isActive: whForm.isActive,
          })
          .eq("id", editingWh.id);
        if (error) throw error;
        toast.success("Warehouse updated!");
      } else {
        const { error } = await supabase.from("Warehouse").insert([
          {
            companyId,
            code: whForm.code,
            name: whForm.name,
            isActive: whForm.isActive,
          },
        ]);
        if (error) throw error;
        toast.success("New warehouse added!");
      }
      setShowWhModal(false);
      await loadInventoryData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save warehouse.");
    } finally {
      setSavingWh(false);
    }
  }

  async function handleDeleteWarehouse(wh: any) {
    if (!confirm(`Delete warehouse "${wh.name}"?`)) return;
    try {
      const { error } = await supabase.from("Warehouse").delete().eq("id", wh.id);
      if (error) throw error;
      toast.success("Warehouse deleted.");
      await loadInventoryData();
    } catch {
      toast.error("Cannot delete a warehouse that has stock or historical transactions.");
    }
  }

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Inventory Hub">
        <div className="space-y-6 relative z-10">
          {/* Top Header */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Supply Chain &amp; Stock Control
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Inventory &amp; Warehouses Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage products, record balanced stock adjustments, and configure your warehouses in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNewWarehouse}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Warehouse className="w-4 h-4 text-teal-600 dark:text-teal-400" /> + Add Warehouse
              </button>

              <Link
                href="/inventory/stock"
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Scale className="w-4 h-4" /> Stock Adjustments
              </Link>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Products
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {loading ? "..." : metrics.activeProducts}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Active catalog SKUs
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Box className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Stock Units On-Hand
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {loading ? "..." : metrics.totalStockUnits.toLocaleString()}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Valued at {currency} {formatAmount(metrics.totalValuation)}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Package className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Low Stock Alerts
                </span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
                  {loading ? "..." : metrics.lowStockCount}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Products at or below reorder level
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Active Warehouses
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                  {loading ? "..." : metrics.activeWarehouses}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Configured locations below
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Warehouse className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Inventory Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {modules.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-teal-500/50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${mod.accent}`}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-teal-500 transition-all" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        {mod.title}
                      </h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500">
                        {mod.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Built-In Warehouses Manager */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Warehouses &amp; Storage Locations
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Feed and manage the warehouses used across Purchase Bills, Stock Adjustments, and Sales.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openNewWarehouse}
                className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Add Warehouse
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className="py-3 px-5">Code</th>
                    <th className="py-3 px-5">Warehouse Name</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-xs text-slate-400">
                        No warehouses created yet. Click &ldquo;+ Add Warehouse&rdquo; to add your main storage location.
                      </td>
                    </tr>
                  ) : (
                    warehouses.map((wh) => (
                      <tr
                        key={wh.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3.5 px-5 font-mono text-xs font-bold text-slate-700 dark:text-zinc-300">
                          {wh.code}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-white">
                          {wh.name}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          {wh.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => openEditWarehouse(wh)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWarehouse(wh)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ADD / EDIT WAREHOUSE MODAL */}
        {showWhModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingWh ? "Edit Warehouse" : "Add Warehouse"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Configure warehouse code and name for inventory tracking.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveWarehouse} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Warehouse Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WH-01"
                    value={whForm.code}
                    onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Warehouse Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Rawalpindi Warehouse"
                    value={whForm.name}
                    onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whForm.isActive}
                    onChange={(e) => setWhForm({ ...whForm, isActive: e.target.checked })}
                    className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Warehouse is Active
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowWhModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingWh}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {savingWh ? "Saving..." : "Save Warehouse"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}