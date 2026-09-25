"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { Save, Settings2, ShoppingCart, ShoppingBag, Package } from "lucide-react";

export default function SettingsPage() {
  const { settings, updateCategory, loading } = useERPConfig();
  const [activeTab, setActiveTab] = useState<"general" | "sales" | "purchases" | "inventory">("sales");
  const [formData, setFormData] = useState(settings);
  const [saving, setSaving] = useState(false);

  // Sync form when global settings load
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateCategory(activeTab, formData[activeTab]);
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings saved successfully!`);
    } catch (error) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse text-teal-500 font-medium tracking-widest">LOADING SETTINGS ENGINE...</div>
    </div>
  );

  const tabs = [
    { id: "general", label: "General", icon: <Settings2 className="w-4 h-4" /> },
    { id: "sales", label: "Sales", icon: <ShoppingCart className="w-4 h-4" /> },
    { id: "purchases", label: "Purchases", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-300 font-sans antialiased">
      <Toaster position="top-right" />
      <ERPShell title="System Settings">
        <div className="max-w-7xl mx-auto p-8 flex flex-col md:flex-row gap-8">
          
          {/* Sidebar Navigation */}
          <div className="w-full md:w-64 shrink-0 space-y-2">
            <h2 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-4 drop-shadow-sm">Configuration</h2>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id 
                    ? "bg-teal-50 dark:bg-white/10 text-teal-700 dark:text-white shadow-sm border border-teal-200 dark:border-white/5" 
                    : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-zinc-400 border border-transparent"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Main Content Pane (IPRoyal Glass) */}
          <div className="flex-1 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden flex flex-col min-h-[650px]">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">{activeTab} Preferences</h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Configure active policies for the {activeTab} module.</p>
              </div>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
              
              {activeTab === "sales" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">Customer & Payment Defaults</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ToggleField label="Allow Cash Sales" value={formData.sales.allowCashSales} onChange={(val) => setFormData({...formData, sales: {...formData.sales, allowCashSales: val}})} />
                      <ToggleField label="Require Customer" value={formData.sales.requireCustomer} onChange={(val) => setFormData({...formData, sales: {...formData.sales, requireCustomer: val}})} />
                      <ToggleField label="Allow Partial Payments" value={formData.sales.allowPartialPayments} onChange={(val) => setFormData({...formData, sales: {...formData.sales, allowPartialPayments: val}})} />
                      <ToggleField label="Auto-Calculate Balance" value={formData.sales.autoCalculateBalance} onChange={(val) => setFormData({...formData, sales: {...formData.sales, autoCalculateBalance: val}})} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">Inventory Control</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ToggleField label="Require Warehouse" value={formData.sales.requireWarehouse} onChange={(val) => setFormData({...formData, sales: {...formData.sales, requireWarehouse: val}})} />
                      <ToggleField label="Allow Negative Stock" value={formData.sales.allowNegativeStock} onChange={(val) => setFormData({...formData, sales: {...formData.sales, allowNegativeStock: val}})} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "purchases" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">Purchase Behaviours</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ToggleField label="Allow Discounts" value={formData.purchases.allowDiscounts} onChange={(val) => setFormData({...formData, purchases: {...formData.purchases, allowDiscounts: val}})} />
                      <ToggleField label="Allow Tax" value={formData.purchases.allowTax} onChange={(val) => setFormData({...formData, purchases: {...formData.purchases, allowTax: val}})} />
                      <ToggleField label="Require Warehouse" value={formData.purchases.requireWarehouse} onChange={(val) => setFormData({...formData, purchases: {...formData.purchases, requireWarehouse: val}})} />
                      <ToggleField label="Require Batch Number" value={formData.purchases.requireBatch} onChange={(val) => setFormData({...formData, purchases: {...formData.purchases, requireBatch: val}})} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <InputField label="Company Name" value={formData.general.companyName} onChange={(val) => setFormData({...formData, general: {...formData.general, companyName: val}})} />
                   <InputField label="Currency Display (e.g. PKR, USD)" value={formData.general.currency} onChange={(val) => setFormData({...formData, general: {...formData.general, currency: val}})} />
                   <InputField label="NTN / Tax ID" value={formData.general.ntn} onChange={(val) => setFormData({...formData, general: {...formData.general, ntn: val}})} />
                </div>
              )}

              {activeTab === "inventory" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <ToggleField label="Enable Global Inventory Tracking" value={formData.inventory.enableInventoryTracking} onChange={(val) => setFormData({...formData, inventory: {...formData.inventory, enableInventoryTracking: val}})} />
                   <ToggleField label="Update Stock Automatically" value={formData.inventory.updateStockAutomatically} onChange={(val) => setFormData({...formData, inventory: {...formData.inventory, updateStockAutomatically: val}})} />
                </div>
              )}

            </div>

            {/* Sticky Save Footer */}
            <div className="p-6 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex justify-end">
              <button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-4 h-4" /> {saving ? "Saving Configuration..." : "Save Changes"}
              </button>
            </div>
          </div>

        </div>
      </ERPShell>
    </div>
  );
}

// Reusable IPRoyal Styled Toggle
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <button 
        onClick={() => onChange(!value)} 
        className={`w-max flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
          value 
            ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400' 
            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400'
        }`}
      >
        <div className={`w-3 h-3 rounded-full transition-colors ${value ? 'bg-teal-500' : 'bg-slate-400 dark:bg-zinc-500'}`} />
        <span className="text-xs font-bold uppercase tracking-wider">{value ? 'Enabled' : 'Disabled'}</span>
      </button>
    </div>
  );
}

// Reusable IPRoyal Styled Input
function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-colors" 
      />
    </div>
  );
}
