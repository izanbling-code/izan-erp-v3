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
  const [companyId, setCompanyId] = useState<string | null>(null);

  // 1. Fetch settings directly from Supabase
  useEffect(() => {
    async function loadSettings() {
      try {
        // Get the real company ID from the database
        const { data: company, error: companyError } = await supabase
          .from("Company")
          .select("id")
          .limit(1)
          .single();

        if (companyError || !company) {
          console.error("No company found in database:", companyError?.message);
          setLoading(false);
          return;
        }

        setCompanyId(company.id);

        // Fetch settings using the real company ID
        const { data, error } = await supabase
          .from("CompanySettings")
          .select("*")
          .eq("companyId", company.id) // ✅ Correct camelCase
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

  // 2. Direct Supabase save
  const updateCategory = async (category: string, data: any) => {
    if (!companyId) {
      console.error("Cannot save: companyId not loaded yet.");
      return;
    }

    // Immediate UI update
    const updatedCategory = { ...(settings[category] || {}), ...data };
    setSettings((prev: any) => ({
      ...prev,
      [category]: updatedCategory
    }));

    // Direct update to Supabase
    const { error } = await supabase
      .from("CompanySettings")
      .update({ [category]: updatedCategory })
      .eq("companyId", companyId); // ✅ Correct camelCase

    if (error) {
      console.error("Supabase update error:", error.message);
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