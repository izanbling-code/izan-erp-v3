"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Plus,
  Download,
  Upload,
  RefreshCw,
  Search,
  Edit3,
  Trash2,
  ShieldCheck,
  Layers,
  CheckCircle2,
  X,
  CornerDownRight,
} from "lucide-react";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

type Account = {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  isActive: boolean;
  systemCode: string | null;
  createdAt: string;
  updatedAt: string;
};

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

const TYPE_BADGE_STYLES: Record<AccountType, string> = {
  ASSET: "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30",
  LIABILITY: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
  EQUITY: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
  REVENUE: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
  EXPENSE: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
};

const emptyForm = {
  id: "",
  code: "",
  name: "",
  type: "ASSET" as AccountType,
  parentId: "",
  description: "",
  isActive: true,
};

export default function ChartOfAccountsPage() {
  const { settings } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AccountType>("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load accounts.");
      setAccounts(data.accounts || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load accounts.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  // Upgraded Hierarchy Logic
  const hierarchicalAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = accounts.filter((account) => {
      if (!showInactive && !account.isActive) return false;
      if (typeFilter !== "ALL" && account.type !== typeFilter) return false;
      if (!query) return true;
      return (
        account.code.toLowerCase().includes(query) ||
        account.name.toLowerCase().includes(query) ||
        TYPE_LABELS[account.type].toLowerCase().includes(query)
      );
    });

    const parents = filtered
      .filter((a) => !a.parentId)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    const children = filtered.filter((a) => a.parentId);

    const sortedList: (Account & { isSubAccount: boolean })[] = [];

    parents.forEach((parent) => {
      sortedList.push({ ...parent, isSubAccount: false });

      const myChildren = children
        .filter((c) => c.parentId === parent.id)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      myChildren.forEach((child) => {
        sortedList.push({ ...child, isSubAccount: true });
      });
    });

    const addedIds = new Set(sortedList.map((a) => a.id));
    filtered.forEach((a) => {
      if (!addedIds.has(a.id)) {
        sortedList.push({ ...a, isSubAccount: Boolean(a.parentId) });
      }
    });

    return sortedList;
  }, [accounts, search, typeFilter, showInactive]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || "",
      description: account.description || "",
      isActive: account.isActive,
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        id: editing?.id || undefined,
        code: form.code,
        name: form.name,
        type: form.type,
        parentId: form.parentId || null,
        description: form.description || null,
        isActive: form.isActive,
      };
      const response = await fetch("/api/accounts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to save account.");
      toast.success(editing ? "Account updated!" : "New account created!");
      await loadAccounts();
      closeForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save account.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: Account) {
    if (account.systemCode) {
      toast.error("System accounts cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(
      `Delete "${account.code} - ${account.name}"?\n\nAccounts with historical references will automatically be deactivated instead.`
    );
    if (!confirmed) return;
    try {
      setError("");
      const response = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete account.");
      await loadAccounts();
      if (data.deactivated) {
        toast.success(data.message || "Account was deactivated.");
      } else {
        toast.success("Account deleted.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete account.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/accounting/accounts/import", {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Server returned invalid data. Ensure your Excel columns match the template!");
      }

      if (!response.ok || !data.ok) throw new Error(data.error || "Import failed. Please check your file formatting.");

      toast.success(data.message || "Accounts imported successfully!");
      await loadAccounts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import accounts.";
      setError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const headers = ["Code", "Name", "Type", "Description", "ParentCode"];
    const row1 = ["1000", "Bank Accounts", "ASSET", "Main parent asset account", ""];
    const row2 = ["1001", "Meezan Bank Checking", "ASSET", "Sub account example", "1000"];

    const csvContent = [headers.join(","), row1.join(","), row2.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ChartOfAccounts_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getParentName(parentId: string | null) {
    if (!parentId) return "—";
    const parent = accountMap.get(parentId);
    return parent ? `${parent.code} — ${parent.name}` : "—";
  }

  const activeCount = accounts.filter((account) => account.isActive).length;
  const systemCount = accounts.filter((account) => account.systemCode).length;
  const cellPad = isCompact ? "py-2 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Chart of Accounts">
        <div className="space-y-6 relative z-10">
          {/* Top Action Header */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                General Ledger Account Hierarchy
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage your company&apos;s financial structure, parent-child sub-accounts, and Balance Sheet / P&amp;L classifications.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={downloadTemplate}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Template
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                {importing ? "Importing..." : "Import Excel"}
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> New Account
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Total Accounts
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{accounts.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Active Accounts
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Protected System Accounts
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{systemCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Accounts Table Card */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            {/* Filters Bar */}
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by code, account name, or type..."
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "ALL" | AccountType)}
                className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="ALL">All Account Types</option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => setShowInactive(event.target.checked)}
                  className="accent-teal-500 w-3.5 h-3.5 rounded cursor-pointer"
                />
                Show Inactive
              </label>

              <button
                type="button"
                onClick={loadAccounts}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} /> Refresh
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium">
                Loading Chart of Accounts...
              </div>
            ) : hierarchicalAccounts.length === 0 ? (
              <div className="py-16 text-center space-y-1">
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">No accounts found</p>
                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Create your first account or adjust your search filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                      <th className={cellPad}>Code</th>
                      <th className={cellPad}>Account Name</th>
                      <th className={cellPad}>Type</th>
                      <th className={cellPad}>Parent Account</th>
                      <th className={cellPad}>Status</th>
                      <th className={`${cellPad} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {hierarchicalAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5 ${
                          !account.isActive ? "opacity-55" : ""
                        } ${account.isSubAccount ? "bg-slate-50/40 dark:bg-zinc-950/30" : ""}`}
                      >
                        <td className={`${cellPad} font-mono text-xs font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap`}>
                          <div className="flex items-center gap-1.5">
                            {account.isSubAccount && (
                              <CornerDownRight className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0 ml-2" />
                            )}
                            <span>{account.code}</span>
                          </div>
                        </td>

                        <td className={cellPad}>
                          <div
                            className={`${
                              account.isSubAccount
                                ? "font-medium text-slate-700 dark:text-zinc-300 pl-2"
                                : "font-bold text-slate-900 dark:text-white"
                            }`}
                          >
                            {account.name}
                          </div>
                          {account.description && (
                            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                              {account.description}
                            </div>
                          )}
                          {account.systemCode && (
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400">
                              <ShieldCheck className="w-3 h-3 text-teal-500" /> System: {account.systemCode}
                            </span>
                          )}
                        </td>

                        <td className={cellPad}>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${
                              TYPE_BADGE_STYLES[account.type]
                            }`}
                          >
                            {TYPE_LABELS[account.type]}
                          </span>
                        </td>

                        <td className={`${cellPad} text-xs text-slate-600 dark:text-zinc-400`}>
                          {getParentName(account.parentId)}
                        </td>

                        <td className={cellPad}>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              account.isActive
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                                : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                account.isActive ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {account.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className={`${cellPad} text-right whitespace-nowrap space-x-2`}>
                          <button
                            type="button"
                            onClick={() => openEdit(account)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit
                          </button>
                          {!account.systemCode && (
                            <button
                              type="button"
                              onClick={() => handleDelete(account)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Create / Edit Modal */}
        {showForm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editing ? "Edit Account" : "Create New Account"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {editing?.systemCode
                      ? "System account code and type are protected."
                      : "Configure account code, classification, and hierarchy."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Code *
                    </label>
                    <input
                      value={form.code}
                      disabled={Boolean(editing?.systemCode)}
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                      required
                      placeholder="e.g. 1010"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Type *
                    </label>
                    <select
                      value={form.type}
                      disabled={Boolean(editing?.systemCode)}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, type: event.target.value as AccountType }))
                      }
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-60 cursor-pointer"
                    >
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Account Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    placeholder="e.g. Main Business Bank Account"
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Parent Account (Optional)
                  </label>
                  <select
                    value={form.parentId}
                    onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">No parent — top-level account</option>
                    {accounts
                      .filter((account) => (editing ? account.id !== editing.id && account.isActive : account.isActive))
                      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} — {account.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    placeholder="Optional notes about what transactions post to this account..."
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 resize-y"
                  />
                </div>

                {editing && (
                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">Account is active</span>
                  </label>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editing ? "Save Changes" : "Create Account"}
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
