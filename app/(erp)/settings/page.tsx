"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { useTheme } from "next-themes";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Save,
  Settings2,
  ShoppingCart,
  ShoppingBag,
  Package,
  Hash,
  Palette,
  Eye,
  X,
  Printer,
  LayoutDashboard,
  Calculator,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const { settings, updateCategory, loading } = useERPConfig();
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<
    "general" | "sales" | "purchases" | "inventory" | "accounting" | "numbering" | "appearance"
  >("appearance");
  const [formData, setFormData] = useState(settings);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || d || []))
      .catch(() => console.log("No COA found"));
  }, []);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateCategory(activeTab, formData[activeTab]);
      if (activeTab === "appearance") setTheme(formData.appearance.theme);
      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings saved!`);
    } catch (error) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-teal-500 font-medium tracking-widest">
          LOADING SETTINGS ENGINE...
        </div>
      </div>
    );

  // Strict filtered lists for Asset -> Receivables and Asset -> Inventory
  const assetAccounts = accounts.filter((a) => a.type === "ASSET");
  const receivableAccounts = assetAccounts.filter((a) => {
    const n = (a.name || "").toLowerCase();
    const s = (a.systemCode || "").toLowerCase();
    return n.includes("receivable") || s.includes("receivable") || s.includes("ar");
  });
  const inventoryAccounts = assetAccounts.filter((a) => {
    const n = (a.name || "").toLowerCase();
    const s = (a.systemCode || "").toLowerCase();
    return n.includes("inventory") || n.includes("stock") || s.includes("inventory");
  });

  const safeReceivableList = receivableAccounts.length > 0 ? receivableAccounts : assetAccounts;
  const safeInventoryList = inventoryAccounts.length > 0 ? inventoryAccounts : assetAccounts;

  const tabs = [
    { id: "general", label: "General", icon: <Settings2 className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "accounting", label: "Accounting", icon: <Calculator className="w-4 h-4" /> },
    { id: "sales", label: "Sales", icon: <ShoppingCart className="w-4 h-4" /> },
    { id: "purchases", label: "Purchases", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "inventory", label: "Inventory", icon: <Package className="w-4 h-4" /> },
    { id: "numbering", label: "Numbering", icon: <Hash className="w-4 h-4" /> },
  ] as const;

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="System Settings">
        <div className="flex flex-col md:flex-row gap-8 relative z-10">
          <div className="w-full md:w-64 shrink-0 space-y-2">
            <h2 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-4 drop-shadow-sm">
              Configuration
            </h2>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

          <div className="flex-1 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden flex flex-col min-h-[650px]">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                  {activeTab} Preferences
                </h2>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                  Configure active policies for the {activeTab} module.
                </p>
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
              {/* ==================== ACCOUNTING TAB ==================== */}
              {activeTab === "accounting" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Global Default Accounts
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
                      These accounts are used as safe fallbacks when a specific product or invoice does not have its own custom accounts mapped.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Accounts Receivable (Customer AR)
                        </label>
                        <select
                          value={formData.accounting?.arAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: { ...formData.accounting, arAccountId: e.target.value },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Accounts Payable (Supplier AP)
                        </label>
                        <select
                          value={formData.accounting?.apAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: { ...formData.accounting, apAccountId: e.target.value },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Sales / Revenue Account
                        </label>
                        <select
                          value={formData.accounting?.defaultSalesAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultSalesAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Inventory Asset Account
                        </label>
                        <select
                          value={formData.accounting?.defaultInventoryAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultInventoryAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Cost of Goods Sold (COGS)
                        </label>
                        <select
                          value={formData.accounting?.defaultCogsAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultCogsAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Purchase Account
                        </label>
                        <select
                          value={formData.accounting?.defaultPurchaseAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultPurchaseAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* TAX & DISCOUNT ACCOUNTS */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2 mt-8">
                      Tax &amp; Discount Accounts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Discount Allowed (Expense)
                        </label>
                        <select
                          value={formData.accounting?.discountAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                discountAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Tax Payable (Liability)
                        </label>
                        <select
                          value={formData.accounting?.taxPayableAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                taxPayableAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* DEFAULT PAYMENT MODE ACCOUNTS (FOR SUPPLIER PAYMENTS & EXPENSES) */}
                  <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 space-y-5 mt-8">
                    <div>
                      <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Automated Payment Mode Accounts (Supplier &amp; Expense Modules)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        When paying Suppliers or recording Expenses, selecting &ldquo;Cash&rdquo; or &ldquo;Online&rdquo; will automatically credit these accounts without asking the user to pick an account.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block mb-1.5">
                          Default Cash Mode Account (Active Cash Book) *
                        </label>
                        <select
                          value={(formData.accounting as any)?.defaultCashAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultCashAccountId: e.target.value,
                              } as any,
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="">Select Default Cash Account...</option>
                          {assetAccounts
                            .filter((a) => a.name.toLowerCase().includes("cash"))
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ? a.code + " - " : ""}
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase block mb-1.5">
                          Default Online Mode Account (Bank GL Account) *
                        </label>
                        <select
                          value={
                            (formData.accounting as any)?.defaultOnlineBankAccountId ||
                            formData.accounting?.loanDepositAccountId ||
                            ""
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                defaultOnlineBankAccountId: e.target.value,
                              } as any,
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-500/30 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                        >
                          <option value="">Select Default Online Bank Account...</option>
                          {assetAccounts
                            .filter((a) => !a.name.toLowerCase().includes("receivable") && !a.name.toLowerCase().includes("inventory"))
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ? a.code + " - " : ""}
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* PURCHASE RETURN, TRANSFER OUT & STOCK ADJUSTMENT ACCOUNTS */}
                  <div className="p-5 rounded-2xl bg-teal-50/50 dark:bg-teal-500/5 border border-teal-200 dark:border-teal-500/20 space-y-5 mt-8">
                    <div>
                      <h3 className="text-sm font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Automated Purchase Return, Transfer Out &amp; Stock Adjustment Accounts
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        Locked strictly to Asset &rarr; Receivable and Asset &rarr; Inventory accounts so invoices and adjustments post automatically without manual selection.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase block mb-1.5">
                          Purchase Return / Transfer Out Receivable (Debit — Asset)
                        </label>
                        <select
                          value={
                            formData.accounting?.returnReceivableAccountId ||
                            formData.accounting?.arAccountId ||
                            ""
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                returnReceivableAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-teal-200 dark:border-teal-500/30 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Receivable Asset Account...</option>
                          {safeReceivableList.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name} (ASSET)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase block mb-1.5">
                          Stock Damage / Shrinkage Offset Account (Stock Adjustments)
                        </label>
                        <select
                          value={
                            formData.accounting?.stockAdjustmentAccountId ||
                            formData.accounting?.defaultCogsAccountId ||
                            ""
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                stockAdjustmentAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-teal-200 dark:border-teal-500/30 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Shrinkage / Offset Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* LOAN & BORROWING ACCOUNTS */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2 mt-8">
                      Loan &amp; Borrowing Accounts (Balance Sheet &amp; Bank)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Loan Payable Account (Liability on Balance Sheet)
                        </label>
                        <select
                          value={formData.accounting?.loanLiabilityAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                loanLiabilityAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Liability Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Loan Deposit / Repayment Account (Bank / Cash Asset)
                        </label>
                        <select
                          value={formData.accounting?.loanDepositAccountId || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              accounting: {
                                ...formData.accounting,
                                loanDepositAccountId: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Bank / Cash Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name} ({a.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== APPEARANCE TAB ==================== */}
              {activeTab === "appearance" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Digital Interface
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SelectField
                        label="Global Theme"
                        value={formData.appearance.theme}
                        options={[
                          { label: "System Match", value: "system" },
                          { label: "Light Mode", value: "light" },
                          { label: "Dark Mode", value: "dark" },
                        ]}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: { ...formData.appearance, theme: val as any },
                          })
                        }
                      />
                      <SelectField
                        label="Data Density"
                        value={formData.appearance.dataDensity}
                        options={[
                          { label: "Comfortable (Spaced)", value: "comfortable" },
                          { label: "Compact (Dense)", value: "compact" },
                        ]}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: { ...formData.appearance, dataDensity: val as any },
                          })
                        }
                      />
                      <SelectField
                        label="Sidebar Mode"
                        value={formData.appearance.sidebarMode}
                        options={[
                          { label: "Expanded", value: "expanded" },
                          { label: "Collapsed", value: "collapsed" },
                        ]}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: { ...formData.appearance, sidebarMode: val as any },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard Modules
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <ToggleField
                        label="Top KPI Cards"
                        value={formData.appearance.dashboard?.showKpis ?? true}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: {
                              ...formData.appearance,
                              dashboard: { ...formData.appearance.dashboard, showKpis: val },
                            },
                          })
                        }
                      />
                      <ToggleField
                        label="Sales Trend Chart"
                        value={formData.appearance.dashboard?.showSalesChart ?? true}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: {
                              ...formData.appearance,
                              dashboard: { ...formData.appearance.dashboard, showSalesChart: val },
                            },
                          })
                        }
                      />
                      <ToggleField
                        label="Stock Status Chart"
                        value={formData.appearance.dashboard?.showStockChart ?? true}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: {
                              ...formData.appearance,
                              dashboard: { ...formData.appearance.dashboard, showStockChart: val },
                            },
                          })
                        }
                      />
                      <ToggleField
                        label="Recent Activity Feed"
                        value={formData.appearance.dashboard?.showActivity ?? true}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: {
                              ...formData.appearance,
                              dashboard: { ...formData.appearance.dashboard, showActivity: val },
                            },
                          })
                        }
                      />
                      <ToggleField
                        label="Top Categories Rank"
                        value={formData.appearance.dashboard?.showCategories ?? true}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: {
                              ...formData.appearance,
                              dashboard: { ...formData.appearance.dashboard, showCategories: val },
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Document Templates
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner relative">
                        <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          Invoice Layout
                        </span>
                        <div className="flex gap-2">
                          <select
                            value={formData.appearance.invoiceTemplate}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                appearance: {
                                  ...formData.appearance,
                                  invoiceTemplate: e.target.value as any,
                                },
                              })
                            }
                            className="flex-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-colors"
                          >
                            <option value="modern">Modern (IPRoyal Glass)</option>
                            <option value="classic">Classic (B&amp;W)</option>
                            <option value="thermal">Thermal (POS)</option>
                          </select>
                        </div>
                      </div>
                      <ToggleField
                        label="Show Logo on Prints"
                        value={formData.appearance.showLogoOnPrints}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            appearance: { ...formData.appearance, showLogoOnPrints: val },
                          })
                        }
                      />
                      <div className="md:col-span-2 space-y-6 pt-4 border-t border-slate-200 dark:border-white/10">
                        <TextAreaField
                          label="Invoice Footer Note"
                          value={formData.appearance.invoiceFooterNote}
                          onChange={(val) =>
                            setFormData({
                              ...formData,
                              appearance: { ...formData.appearance, invoiceFooterNote: val },
                            })
                          }
                          placeholder="e.g. Thank you for your business!"
                        />
                        <TextAreaField
                          label="Payment Instructions (Shown ONLY on unpaid invoices)"
                          value={formData.appearance.paymentInstructions}
                          onChange={(val) =>
                            setFormData({
                              ...formData,
                              appearance: { ...formData.appearance, paymentInstructions: val },
                            })
                          }
                          placeholder="e.g. Please transfer funds to..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== SALES TAB ==================== */}
              {activeTab === "sales" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Invoice Configuration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Invoice Prefix
                        </label>
                        <input
                          type="text"
                          value={formData.sales?.invoicePrefix || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, invoicePrefix: e.target.value },
                            })
                          }
                          placeholder="e.g. INV-"
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Default Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          value={formData.sales?.defaultTaxRate || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, defaultTaxRate: Number(e.target.value) },
                            })
                          }
                          placeholder="e.g. 17"
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="col-span-1 md:col-span-2 flex flex-wrap gap-8 mt-2 pt-5 border-t border-slate-200 dark:border-white/10">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.sales?.requireWarehouse || false}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                sales: { ...formData.sales, requireWarehouse: e.target.checked },
                              })
                            }
                            className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                            Require Warehouse
                          </span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.sales?.requireBatch || false}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                sales: { ...formData.sales, requireBatch: e.target.checked },
                              })
                            }
                            className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                            Require Batch
                          </span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.sales?.allowDiscount || false}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                sales: { ...formData.sales, allowDiscount: e.target.checked },
                              })
                            }
                            className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                            Allow Discounts
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Order Pipeline Configuration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        label="Default Courier Partner"
                        value={formData.sales?.defaultCourier || "TCS"}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            sales: { ...formData.sales, defaultCourier: val },
                          })
                        }
                      />
                      <SelectField
                        label="Default Payment Status"
                        value={formData.sales?.defaultPaymentStatus || "PENDING"}
                        options={[
                          { label: "COD (Pending)", value: "PENDING" },
                          { label: "Pre-Paid (Paid)", value: "PAID" },
                        ]}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            sales: { ...formData.sales, defaultPaymentStatus: val as any },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-10">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Courier Accounting (General Ledger)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 p-4 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-xl">
                        <label className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase block mb-1.5">
                          Courier Deposit Account (Bank/Cash) *
                        </label>
                        <select
                          value={formData.sales?.courierDepositAccount || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, courierDepositAccount: e.target.value },
                            })
                          }
                          className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-teal-200 dark:border-teal-500/30 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Where does the courier send the money?</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Courier Payable (Liability)
                        </label>
                        <select
                          value={formData.sales?.courierPayableAccount || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, courierPayableAccount: e.target.value },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Courier Collection (Asset)
                        </label>
                        <select
                          value={formData.sales?.courierCollectionAccount || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: {
                                ...formData.sales,
                                courierCollectionAccount: e.target.value,
                              },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Delivery Income (Revenue)
                        </label>
                        <select
                          value={formData.sales?.deliveryIncomeAccount || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, deliveryIncomeAccount: e.target.value },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Delivery Expense (Expense)
                        </label>
                        <select
                          value={formData.sales?.deliveryExpenseAccount || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, deliveryExpenseAccount: e.target.value },
                            })
                          }
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer appearance-none"
                        >
                          <option value="">Select Account...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code ? a.code + " - " : ""}
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 mb-2">
                    <h4 className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Storefront Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Public Store Name
                        </label>
                        <input
                          type="text"
                          value={formData.sales?.storeName || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, storeName: e.target.value },
                            })
                          }
                          placeholder="e.g. Izan Bling Official"
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Store Policy Link
                        </label>
                        <input
                          type="text"
                          value={formData.sales?.storePolicyLink || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, storePolicyLink: e.target.value },
                            })
                          }
                          placeholder="e.g. /policies/refund"
                          className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <div className="mt-5">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.sales?.enablePublicShop ?? true}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sales: { ...formData.sales, enablePublicShop: e.target.checked },
                            })
                          }
                          className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                          Enable Public Storefront
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== PURCHASES TAB ==================== */}
              {activeTab === "purchases" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Procurement &amp; Bill Policies
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        label="Purchase Bill Prefix"
                        value={(formData as any).purchases?.billPrefix || "PB-"}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            purchases: { ...(formData as any).purchases, billPrefix: val },
                          } as any)
                        }
                      />
                      <InputField
                        label="Purchase Return Prefix"
                        value={(formData as any).purchases?.returnPrefix || "PR-"}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            purchases: { ...(formData as any).purchases, returnPrefix: val },
                          } as any)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== INVENTORY TAB ==================== */}
              {activeTab === "inventory" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Inventory &amp; Stock Control Policies
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SelectField
                        label="Costing Method"
                        value={(formData as any).inventory?.costingMethod || "MOVING_AVERAGE"}
                        options={[
                          { label: "Moving Average Cost (Recommended)", value: "MOVING_AVERAGE" },
                          { label: "FIFO (Batch Based)", value: "FIFO" },
                        ]}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            inventory: { ...(formData as any).inventory, costingMethod: val },
                          } as any)
                        }
                      />
                      <ToggleField
                        label="Allow Negative Stock"
                        value={(formData as any).inventory?.allowNegativeStock ?? false}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            inventory: { ...(formData as any).inventory, allowNegativeStock: val },
                          } as any)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== NUMBERING TAB ==================== */}
              {activeTab === "numbering" && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/10 pb-2">
                      Document Numbering Prefixes
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputField
                        label="Loan Reference Prefix"
                        value={formData.numbering?.loanPrefix || "LN-"}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            numbering: { ...formData.numbering, loanPrefix: val },
                          })
                        }
                      />
                      <InputField
                        label="Journal Entry Prefix"
                        value={formData.numbering?.journalPrefix || "JE-"}
                        onChange={(val) =>
                          setFormData({
                            ...formData,
                            numbering: { ...formData.numbering, journalPrefix: val },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== GENERAL TAB ==================== */}
              {activeTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    label="Company Name"
                    value={formData.general.companyName}
                    onChange={(val) =>
                      setFormData({
                        ...formData,
                        general: { ...formData.general, companyName: val },
                      })
                    }
                  />
                  <InputField
                    label="Base Currency"
                    value={formData.general.currency}
                    onChange={(val) =>
                      setFormData({ ...formData, general: { ...formData.general, currency: val } })
                    }
                  />
                  <InputField
                    label="NTN / Tax ID"
                    value={formData.general.ntn}
                    onChange={(val) =>
                      setFormData({ ...formData, general: { ...formData.general, ntn: val } })
                    }
                  />
                  <InputField
                    label="Contact Phone"
                    value={formData.general.phone}
                    onChange={(val) =>
                      setFormData({ ...formData, general: { ...formData.general, phone: val } })
                    }
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </ERPShell>
    </>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <textarea
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-lg text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-colors h-24 custom-scrollbar"
      />
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-max flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
          value
            ? "bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400"
            : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400"
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full transition-colors ${
            value ? "bg-teal-500" : "bg-slate-400 dark:bg-zinc-500"
          }`}
        />
        <span className="text-xs font-bold uppercase tracking-wider">
          {value ? "Enabled" : "Disabled"}
        </span>
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-colors"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950/50 shadow-inner">
      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-sm outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-colors"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}