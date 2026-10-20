"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase"; // Adjust path if your supabase client is elsewhere
import { Settings, Save, Loader2 } from "lucide-react";

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    storeName: "Izan Bling",
    email: "admin@izan.com",
    currency: "PKR",
    deliveryCharge: 250,
    freeShippingThreshold: 5000,
  });

  // Load current settings on mount
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("CompanySettings")
        .select("general")
        .single();
      
      if (data?.general) {
        setSettings((prev) => ({ ...prev, ...data.general }));
      }
      setLoading(false);
    }
    load();
  }, []);

  // Save settings to Supabase
  const handleSave = async () => {
    setSaving(true);
    try {
      // Get the first company ID
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      
      if (company) {
        await supabase
          .from("CompanySettings")
          .update({ general: settings })
          .eq("companyId", company.id);
          
        alert("Settings saved successfully!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-teal-500" /> Store Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage shipping, taxes, and store details.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">General Details</h2>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Store Name</label>
            <input 
              type="text" 
              value={settings.storeName}
              onChange={(e) => setSettings({...settings, storeName: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Contact Email</label>
            <input 
              type="email" 
              value={settings.email}
              onChange={(e) => setSettings({...settings, email: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500" 
            />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-white/5 p-6 space-y-4">
          <h2 className="font-bold text-slate-900 dark:text-white mb-4">Shipping & Delivery</h2>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Standard Delivery Charge (Rs.)</label>
            <input 
              type="number" 
              value={settings.deliveryCharge}
              onChange={(e) => setSettings({...settings, deliveryCharge: Number(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Free Shipping Threshold (Rs.)</label>
            <input 
              type="number" 
              value={settings.freeShippingThreshold}
              onChange={(e) => setSettings({...settings, freeShippingThreshold: Number(e.target.value)})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 rounded-lg text-sm dark:text-white outline-none focus:border-teal-500" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}