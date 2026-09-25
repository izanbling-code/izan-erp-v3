"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ERPSystemSettings, DEFAULT_ERP_SETTINGS } from "@/app/types/erp-settings";

type SettingsContextType = {
  settings: ERPSystemSettings;
  loading: boolean;
  updateCategory: (category: keyof ERPSystemSettings, values: any) => Promise<void>;
  formatAmount: (amount: number) => string;
  formatDate: (dateStr: string) => string;
  currency: string;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ERPSystemSettings>(DEFAULT_ERP_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateCategory = async (category: keyof ERPSystemSettings, values: any) => {
    const updated = {
      ...settings,
      [category]: { ...settings[category], ...values },
    };
    setSettings(updated);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
  };

  const formatAmount = (amount: number) => {
    const decimals = settings.general?.decimalPlaces ?? 2;
    return (Number(amount) || 0).toLocaleString("en-PK", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();

    switch (settings.general?.dateFormat) {
      case "MM/DD/YYYY": return `${month}/${day}/${year}`;
      case "YYYY-MM-DD": return `${year}-${month}-${day}`;
      default: return `${day}/${month}/${year}`;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateCategory,
        formatAmount,
        formatDate,
        currency: settings.general?.currency || "PKR",
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useERPConfig<T extends keyof ERPSystemSettings>(category?: T) {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useERPConfig must be used within SettingsProvider");
  }
  return {
    ...context,
    config: category ? context.settings[category] : context.settings,
  };
}
