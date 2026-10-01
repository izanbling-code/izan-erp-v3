"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";

const SettingsContext = createContext<any>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<any>({
    general: { currency: "PKR", companyName: "" },
    sales: {},
    accounting: {},
    appearance: { theme: "dark" },
    purchases: {},
    inventory: {},
    numbering: {}
  });
  const [loading, setLoading] = useState(true);

  // 1. Fetch settings directly from Supabase on load
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("*")
          .eq("company_id", "default_company")
          .maybeSingle();

        if (error) {
          console.error("Supabase load error:", error.message);
        } else if (data) {
          setSettings((prev: any) => ({
            ...prev,
            general: data.general || prev.general,
            sales: data.sales || {},
            accounting: data.accounting || {},
            appearance: data.appearance || prev.appearance,
            purchases: data.purchases || {},
            inventory: data.inventory || {},
            numbering: data.numbering || {}
          }));
        }
      } catch (err) {
        console.error("Failed to connect to Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  // 2. Direct Supabase save — no API routes or remapping needed
  const updateCategory = async (category: string, data: any) => {
    // Immediate UI update
    const updatedCategory = { ...(settings[category] || {}), ...data };
    setSettings((prev: any) => ({
      ...prev,
      [category]: updatedCategory
    }));

    // Direct update to Supabase
    const { error } = await supabase
      .from("company_settings")
      .update({ [category]: updatedCategory })
      .eq("company_id", "default_company");

    if (error) {
      console.error("Supabase update error:", error.message);
      throw new Error(error.message);
    }
  };

  const formatAmount = (num: number) =>
    Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const currency = settings.general?.currency || "PKR";

  return (
    <SettingsContext.Provider value={{ settings, updateCategory, loading, formatAmount, currency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useERPConfig(category?: string) {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useERPConfig must be used within a SettingsProvider");
  if (category) return { ...ctx, config: ctx.settings[category] || {} };
  return ctx;
}
