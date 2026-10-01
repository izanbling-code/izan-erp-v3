"use client";

import { useEffect, useState, FormEvent } from "react";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  RefreshCw,
  Calendar,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Scale,
  X,
} from "lucide-react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type CashRow = {
  id: string;
  date: string;
  reference: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  balance: number;
};

type VoucherType = "CRV" | "CPV" | "CTV";

export default function CashBookPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [rows, setRows] = useState<CashRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Voucher Modal State
  const [showModal, setShowModal] = useState(false);
  const [voucherType, setVoucherType] = useState<VoucherType>("CRV");
  const [submitting, setSubmitting] = useState(false);
  const [vForm, setVForm] = useState({
    offsetAccountId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
    description: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      // Load All Accounts for the Offset Dropdown
      const accRes = await fetch("/api/accounts", { cache: "no-store" });
      const accJson = await accRes.json();
      if (accJson.ok) {
        setAllAccounts((accJson.accounts || []).filter((a: any) => a.isActive));
      }

      // Load Cash Book Ledger
      const query = new URLSearchParams();
      if (selectedAccountId) query.append("accountId", selectedAccountId);
      if (fromDate) query.append("from", fromDate);
      if (toDate) query.append("to", toDate);

      const res = await fetch(`/api/banking/cashbook?${query.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load Cash Book");

      // STRICT CASH BOOK ARCHITECTURE: Block digital banks from Cash Book
      const strictCashAccounts = (json.accounts || []).filter((acc: any) => {
        const name = acc.name.toLowerCase();
        return (
          name.includes("cash") &&
          !name.includes("bank") &&
          !name.includes("easypaisa") &&
          !name.includes("meezan")
        );
      });
      setCashAccounts(strictCashAccounts);

      if (!selectedAccountId && strictCashAccounts.length > 0) {
        setSelectedAccountId(strictCashAccounts[0].id);
      } else if (
        json.selectedAccountId &&
        strictCashAccounts.some((a: any) => a.id === json.selectedAccountId)
      ) {
        setSelectedAccountId(json.selectedAccountId);
      }

      setRows(json.rows || []);
      setOpeningBalance(Number(json.openingBalance || 0));
      setClosingBalance(Number(json.closingBalance || 0));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load Cash Book";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, fromDate, toDate]);

  const totalIn = rows.reduce((sum, row) => sum + Number(row.moneyIn || 0), 0);
  const totalOut = rows.reduce((sum, row) => sum + Number(row.moneyOut || 0), 0);

  function openVoucherModal(type: VoucherType) {
    if (!selectedAccountId) {
      toast.error("Please select an active Cash account first.");
      return;
    }
    setVoucherType(type);
    setVForm({
      offsetAccountId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      reference: "",
      description: "",
    });
    setShowModal(true);
  }

  async function handleVoucherSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vForm.offsetAccountId) {
      toast.error("Please select an offsetting account.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        type: voucherType,
        cashAccountId: selectedAccountId,
        offsetAccountId: vForm.offsetAccountId,
        amount: Number(vForm.amount),
        date: vForm.date,
        reference: vForm.reference,
        description: vForm.description,
      };

      const res = await fetch("/api/banking/cashbook/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to post voucher.");

      toast.success(`${voucherType} posted to General Ledger!`);
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  const offsetLabel =
    voucherType === "CRV"
      ? "Receive From (Customer / Revenue)"
      : voucherType === "CPV"
      ? "Pay To (Vendor / Expense)"
      : "Transfer Account (Bank / Cash)";

  const modalTitle =
    voucherType === "CRV"
      ? "Cash Receipt Voucher (CRV)"
      : voucherType === "CPV"
      ? "Cash Payment Voucher (CPV)"
      : "Contra Transfer Voucher (CTV)";

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Cash Book">
        <div className="space-y-6 relative z-10">
          {/* Top Header & Voucher Actions */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Physical Cash Book &amp; Voucher Register
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage operational cash flows, daily petty cash, and post standard CRV, CPV, and Contra vouchers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-shortcut="r"
                onClick={() => openVoucherModal("CRV")}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" /> Receive Cash (CRV)
              </button>

              <button
                type="button"
                data-shortcut="p"
                onClick={() => openVoucherModal("CPV")}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-500/20 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" /> Pay Cash (CPV)
              </button>

              <button
                type="button"
                data-shortcut="t"
                onClick={() => openVoucherModal("CTV")}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeftRight className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Transfer (CTV)
              </button>
            </div>
          </div>

          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Opening Balance
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {currency} {formatAmount(openingBalance)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-400">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  Total Money In (Dr)
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {currency} {formatAmount(totalIn)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                  Total Money Out (Cr)
                </span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                  {currency} {formatAmount(totalOut)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-teal-200/80 dark:border-teal-500/20 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                  Active Closing Balance
                </span>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1.5">
                  {currency} {formatAmount(closingBalance)}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter & Cash Ledger Table Card */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            {/* Filters Toolbar */}
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[240px]">
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Active Cash Book
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm font-semibold outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {cashAccounts.length === 0 ? (
                      <option value="">No Cash Account Found</option>
                    ) : (
                      cashAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} — {acc.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  From Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">
                  To Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-zinc-400 text-xs font-bold transition-all"
                >
                  Clear Dates
                </button>
              )}

              <button
                type="button"
                onClick={loadData}
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

            {/* Ledger Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Date</th>
                    <th className={cellPad}>Voucher / Ref</th>
                    <th className={`${cellPad} w-1/3`}>Description</th>
                    <th className={`${cellPad} text-right text-emerald-600 dark:text-emerald-400`}>
                      Money In (Dr)
                    </th>
                    <th className={`${cellPad} text-right text-rose-600 dark:text-rose-400`}>
                      Money Out (Cr)
                    </th>
                    <th className={`${cellPad} text-right`}>Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading && rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium"
                      >
                        Loading cash book ledger...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No cash transactions found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Use Receive Cash (CRV), Pay Cash (CPV), or Transfer (CTV) above to record entries.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className={`${cellPad} text-slate-600 dark:text-zinc-300 whitespace-nowrap`}>
                          {row.date}
                        </td>
                        <td className={`${cellPad} font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                          {row.reference || "—"}
                        </td>
                        <td className={`${cellPad} text-slate-700 dark:text-zinc-300`}>
                          {row.description}
                        </td>
                        <td className={`${cellPad} text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}>
                          {row.moneyIn > 0 ? `${currency} ${formatAmount(row.moneyIn)}` : "—"}
                        </td>
                        <td className={`${cellPad} text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap`}>
                          {row.moneyOut > 0 ? `${currency} ${formatAmount(row.moneyOut)}` : "—"}
                        </td>
                        <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                          {currency} {formatAmount(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* VOUCHER ENTRY MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      voucherType === "CRV"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : voucherType === "CPV"
                        ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400"
                        : "bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400"
                    }`}
                  >
                    {voucherType === "CRV" ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : voucherType === "CPV" ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowLeftRight className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{modalTitle}</h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Post an active double-entry cash voucher to the General Ledger.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleVoucherSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Voucher Date *
                    </label>
                    <input
                      required
                      type="date"
                      value={vForm.date}
                      onChange={(e) => setVForm({ ...vForm, date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Amount ({currency}) *
                    </label>
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={vForm.amount}
                      onChange={(e) => setVForm({ ...vForm, amount: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    {offsetLabel} *
                  </label>
                  <select
                    required
                    value={vForm.offsetAccountId}
                    onChange={(e) => setVForm({ ...vForm, offsetAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Select Chart of Account --</option>
                    {allAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id} disabled={acc.id === selectedAccountId}>
                        {acc.code} — {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Invoice / Reference #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-001"
                    value={vForm.reference}
                    onChange={(e) => setVForm({ ...vForm, reference: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Description / Narration *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Reason for cash transaction..."
                    value={vForm.description}
                    onChange={(e) => setVForm({ ...vForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50 ${
                      voucherType === "CRV"
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20"
                        : voucherType === "CPV"
                        ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20"
                        : "bg-teal-600 hover:bg-teal-500 shadow-teal-500/20"
                    }`}
                  >
                    {submitting ? "Posting..." : "Post Voucher"}
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