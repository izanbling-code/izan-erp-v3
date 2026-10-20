"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Landmark,
  Plus,
  Edit3,
  Trash2,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Wallet,
  X,
} from "lucide-react";

type BankAccount = {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string | null;
  branchCode: string | null;
  currency: string;
  isActive: boolean;
  openingBalance: number;
  clearedBalance: number;
  pendingBalance: number;
  totalBookBalance: number;
};

export default function BankDirectoryPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    iban: "",
    branchCode: "",
    openingBalance: "",
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    iban: "",
    branchCode: "",
    isActive: true,
    openingBalance: "",
  });

  const [submitting, setSubmitting] = useState(false);

  async function loadDirectory() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/banking/accounts?includeInactive=${includeInactive}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        setAccounts(json.accounts || []);
      } else {
        setError(json.error || "Failed to load bank accounts.");
      }
    } catch {
      setError("Failed to connect to banking service.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDirectory();
  }, [includeInactive]);

  async function handleAddBank(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/banking/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok || (json && json.ok === false)) {
        throw new Error(json?.error || "Failed to register bank account.");
      }
      toast.success("Bank account registered!");
      setShowAddModal(false);
      setAddForm({
        bankName: "",
        accountTitle: "",
        accountNumber: "",
        iban: "",
        branchCode: "",
        openingBalance: "",
      });
      loadDirectory();
    } catch (err: any) {
      toast.error(err.message || "Failed to register bank account.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(acc: BankAccount) {
    setEditingId(acc.id);
    setEditForm({
      bankName: acc.bankName,
      accountTitle: acc.accountTitle,
      accountNumber: acc.accountNumber,
      iban: acc.iban || "",
      branchCode: acc.branchCode || "",
      isActive: acc.isActive,
      openingBalance: String(acc.openingBalance ?? 0),
    });
    setShowEditModal(true);
  }

  async function handleEditBank(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/banking/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const json = await res.json();
      if (!res.ok || (json && json.ok === false)) {
        throw new Error(json?.error || "Failed to update bank account.");
      }
      toast.success("Bank account updated!");
      setShowEditModal(false);
      setEditingId(null);
      loadDirectory();
    } catch (err: any) {
      toast.error(err.message || "Failed to update bank account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBank(acc: BankAccount) {
    if (!confirm(`Are you sure you want to delete ${acc.bankName} (${acc.accountNumber})?`)) return;
    try {
      const res = await fetch(`/api/banking/accounts?id=${acc.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error || "Could not delete bank account.");
      } else {
        toast.success("Bank account removed.");
      }
      loadDirectory();
    } catch {
      toast.error("Delete failed.");
    }
  }

  const activeAccounts = accounts.filter((a) => a.isActive);
  const totalLiquidity = activeAccounts.reduce((sum, acc) => sum + Number(acc.totalBookBalance || 0), 0);
  const totalCleared = activeAccounts.reduce((sum, acc) => sum + Number(acc.clearedBalance || 0), 0);
  const totalPending = activeAccounts.reduce((sum, acc) => sum + Number(acc.pendingBalance || 0), 0);

  const cellPad = isCompact ? "py-2.5 px-4" : "py-4 px-6";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Bank Directory">
        <div className="space-y-6 relative z-10">
          {/* Top Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Corporate Banking & Liquidity Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage business bank accounts, live general ledger balances, opening balances, and statement reconciliations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="accent-teal-500 w-3.5 h-3.5 rounded cursor-pointer"
                />
                Show Inactive
              </label>

              <button
                type="button"
                onClick={loadDirectory}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} /> Refresh
              </button>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Bank Account
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Total Active Liquidity
                </span>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">
                  {currency} {formatAmount(totalLiquidity)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Across {activeAccounts.length} active account(s)
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Cleared Bank Balance
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {currency} {formatAmount(totalCleared)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Verified &amp; settled funds
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Pending / Unreconciled
                </span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {currency} {formatAmount(totalPending)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Awaiting clearance
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Enterprise Directory Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center gap-2.5">
              <Landmark className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Registered Bank Accounts</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Click &ldquo;Manage&rdquo; on any bank account to view transactions, loan deposits, and reconcile statements.
                </p>
              </div>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Bank Details</th>
                    <th className={cellPad}>Account Info</th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Live Ledger Balance</th>
                    <th className={`${cellPad} text-center`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium">
                        Loading bank directory...
                      </td>
                    </tr>
                  ) : accounts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-14 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No bank accounts registered
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ Add Bank Account&rdquo; above to link your first business bank account.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr
                        key={acc.id}
                        className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5 ${
                          !acc.isActive ? "opacity-60 bg-slate-50/40 dark:bg-zinc-950/40" : ""
                        }`}
                      >
                        <td className={cellPad}>
                          <div className="font-bold text-slate-900 dark:text-white">{acc.bankName}</div>
                          <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{acc.accountTitle}</div>
                        </td>

                        <td className={cellPad}>
                          <div className="font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                            {acc.accountNumber}
                          </div>
                          {acc.iban && (
                            <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                              IBAN: {acc.iban}
                            </div>
                          )}
                          {acc.branchCode && (
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                              Branch Code: {acc.branchCode}
                            </div>
                          )}
                        </td>

                        <td className={`${cellPad} text-center`}>
                          {acc.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              INACTIVE
                            </span>
                          )}
                        </td>

                        <td className={`${cellPad} text-right`}>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {acc.currency || currency} {formatAmount(acc.totalBookBalance)}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                            Opening: {formatAmount(acc.openingBalance || 0)}
                          </div>
                        </td>

                        <td className={`${cellPad} text-center whitespace-nowrap`}>
                          <div className="inline-flex items-center justify-center gap-2">
                            <Link
                              href={`/accounting/banking/${acc.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-600 hover:text-white text-xs font-bold transition-all shadow-sm"
                            >
                              Manage <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEditModal(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                              title="Edit Bank Account"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(acc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all"
                              title="Delete Bank Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* EDIT BANK MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Bank Account</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Update account details or adjust the opening balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditBank} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Bank Name *
                    </label>
                    <input
                      required
                      value={editForm.bankName}
                      onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Title *
                    </label>
                    <input
                      required
                      value={editForm.accountTitle}
                      onChange={(e) => setEditForm({ ...editForm, accountTitle: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Number *
                    </label>
                    <input
                      required
                      value={editForm.accountNumber}
                      onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      IBAN
                    </label>
                    <input
                      value={editForm.iban}
                      onChange={(e) => setEditForm({ ...editForm, iban: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Branch Code
                    </label>
                    <input
                      value={editForm.branchCode}
                      onChange={(e) => setEditForm({ ...editForm, branchCode: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-white/10">
                    <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                      Opening Balance ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.openingBalance}
                      onChange={(e) => setEditForm({ ...editForm, openingBalance: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    />
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 block">
                      Updating this safely syncs Subledger &amp; General Ledger opening records automatically.
                    </span>
                  </div>

                  <div className="sm:col-span-2 pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="accent-teal-500 w-4 h-4 rounded cursor-pointer"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                        Account is Active
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD BANK MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Register Bank Account</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Creates a linked Bank Account and General Ledger Asset account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddBank} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Bank Name *
                    </label>
                    <input
                      required
                      placeholder="e.g. Meezan Bank"
                      value={addForm.bankName}
                      onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Title *
                    </label>
                    <input
                      required
                      placeholder="e.g. Izan Bling Official"
                      value={addForm.accountTitle}
                      onChange={(e) => setAddForm({ ...addForm, accountTitle: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Account Number *
                    </label>
                    <input
                      required
                      placeholder="e.g. 0101-0101234567"
                      value={addForm.accountNumber}
                      onChange={(e) => setAddForm({ ...addForm, accountNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      IBAN
                    </label>
                    <input
                      placeholder="PK00MEZN0000..."
                      value={addForm.iban}
                      onChange={(e) => setAddForm({ ...addForm, iban: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Branch Code
                    </label>
                    <input
                      placeholder="e.g. 0101"
                      value={addForm.branchCode}
                      onChange={(e) => setAddForm({ ...addForm, branchCode: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-white/10">
                    <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                      Opening Balance ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={addForm.openingBalance}
                      onChange={(e) => setAddForm({ ...addForm, openingBalance: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {submitting ? "Registering..." : "Register Bank"}
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

