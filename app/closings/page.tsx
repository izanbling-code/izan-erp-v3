"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Lock,
  Unlock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  BookOpen,
  ShieldCheck,
  Eye,
  X,
} from "lucide-react";

type PnlBreakdownItem = {
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  amount: number;
};

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "LOCKED" | "CLOSED";
  closedAt: string | null;
  closedBy: string | null;
  totalRevenue?: number;
  totalExpense?: number;
  netProfit?: number;
  closingJournalId?: string | null;
  closingJournalNo?: string | null;
  liveRevenue?: number;
  liveExpense?: number;
  liveNetProfit?: number;
  unpostedJournalsCount?: number;
  pnlBreakdown?: PnlBreakdownItem[];
};

export default function MonthlyClosingsPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [processing, setProcessing] = useState("");

  // Inspect Month P&L Sweep Modal
  const [inspectPeriod, setInspectPeriod] = useState<Period | null>(null);

  async function loadPeriods() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails([]);
      const res = await fetch("/api/accounting/periods", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load periods");
      }
      setPeriods(json.periods || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load periods";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  async function updatePeriodStatus(
    period: Period,
    status: "OPEN" | "LOCKED" | "CLOSED"
  ) {
    const actionName =
      status === "CLOSED"
        ? `close ${period.name} and sweep its Revenue & Expenses into 3200 - Retained Earnings`
        : status === "LOCKED"
        ? `soft-lock ${period.name} for audit review`
        : `unlock & reopen ${period.name} (reversing any closing sweep entry)`;

    if (!window.confirm(`Are you sure you want to ${actionName}?`)) return;

    try {
      setProcessing(period.id);
      setError("");
      setErrorDetails([]);
      setSuccess("");

      const res = await fetch("/api/accounting/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: period.id, status }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.details) setErrorDetails(json.details);
        throw new Error(json.error || "Failed to update period");
      }

      setSuccess(json.message);
      toast.success(json.message || `${period.name} updated!`);
      await loadPeriods();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update period";
      setError(msg);
      toast.error(msg);
    } finally {
      setProcessing("");
    }
  }

  const ytdTotals = useMemo(() => {
    let rev = 0;
    let exp = 0;
    let closedCount = 0;
    let lockedCount = 0;

    periods.forEach((p) => {
      const r =
        p.status === "CLOSED" && p.totalRevenue !== undefined
          ? Number(p.totalRevenue)
          : Number(p.liveRevenue || 0);
      const e =
        p.status === "CLOSED" && p.totalExpense !== undefined
          ? Number(p.totalExpense)
          : Number(p.liveExpense || 0);
      rev += r;
      exp += e;
      if (p.status === "CLOSED") closedCount++;
      if (p.status === "LOCKED") lockedCount++;
    });

    return {
      revenue: rev,
      expense: exp,
      netProfit: rev - exp,
      closedCount,
      lockedCount,
    };
  }, [periods]);

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Monthly Closings & Fiscal Periods">
        <div className="space-y-6 relative z-10">
          {/* Header */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" /> Automated P&amp;L Reset &amp; Retained Earnings Roll-Up
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Fiscal Periods &amp; Monthly Closings
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage accounting periods, soft-lock months for review, or close months to zero out Revenue/Expense ledgers into{" "}
                <strong>3200 - Retained Earnings</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/accounting/journals"
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-500" /> View Journals
              </Link>

              <button
                type="button"
                onClick={loadPeriods}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />{" "}
                Refresh Periods
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  YTD Revenue (4xxx)
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {currency} {formatAmount(ytdTotals.revenue)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Total sales &amp; income
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                  YTD Expenses (5xxx)
                </span>
                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                  {currency} {formatAmount(ytdTotals.expense)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  COGS, operating &amp; finance
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-teal-200/80 dark:border-teal-500/20 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                  YTD Net Profit / (Loss)
                </span>
                <p
                  className={`text-2xl font-bold mt-1.5 ${
                    ytdTotals.netProfit >= 0
                      ? "text-teal-600 dark:text-teal-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {currency} {formatAmount(ytdTotals.netProfit)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Sweeps to 3200 - Retained Earnings
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Closed / Locked Months
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {ytdTotals.closedCount} Closed • {ytdTotals.lockedCount} Locked
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Out of {periods.length} fiscal periods
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Validation Error Alert Box */}
          {error && (
            <div className="p-5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 rounded-2xl shadow-sm flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-sm block">{error}</span>
                  {errorDetails.length > 0 && (
                    <ul className="mt-2 ml-4 list-disc text-xs text-rose-700 dark:text-rose-300 font-medium space-y-1">
                      {errorDetails.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setErrorDetails([]);
                }}
                className="text-rose-400 hover:text-rose-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {success}
              </span>
              <button type="button" onClick={() => setSuccess("")}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Fiscal Periods Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-400 dark:text-zinc-500 font-semibold animate-pulse">
                Loading fiscal periods &amp; calculating P&amp;L balances...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold bg-slate-50/50 dark:bg-zinc-950/50">
                      <th className={cellPad}>Period Name</th>
                      <th className={cellPad}>Date Window</th>
                      <th className={`${cellPad} text-right`}>Revenue (4xxx)</th>
                      <th className={`${cellPad} text-right`}>Expenses (5xxx)</th>
                      <th className={`${cellPad} text-right`}>Net Profit / (Loss)</th>
                      <th className={`${cellPad} text-center`}>Status</th>
                      <th className={cellPad}>Closing Sweep &amp; Audit</th>
                      <th className={`${cellPad} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {periods.map((p) => {
                      const isClosed = p.status === "CLOSED";
                      const isLocked = p.status === "LOCKED";
                      const isOpen = p.status === "OPEN";

                      const rev =
                        isClosed && p.totalRevenue !== undefined && Number(p.totalRevenue) !== 0
                          ? Number(p.totalRevenue)
                          : Number(p.liveRevenue || 0);
                      const exp =
                        isClosed && p.totalExpense !== undefined && Number(p.totalExpense) !== 0
                          ? Number(p.totalExpense)
                          : Number(p.liveExpense || 0);
                      const net = rev - exp;

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className={`${cellPad} font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {p.name}
                          </td>

                          <td className={`${cellPad} text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap`}>
                            {new Date(p.startDate).toLocaleDateString()} &rarr;{" "}
                            {new Date(p.endDate).toLocaleDateString()}
                          </td>

                          <td className={`${cellPad} text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}>
                            {currency} {formatAmount(rev)}
                          </td>

                          <td className={`${cellPad} text-right font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap`}>
                            {currency} {formatAmount(exp)}
                          </td>

                          <td
                            className={`${cellPad} text-right font-bold whitespace-nowrap ${
                              net >= 0
                                ? "text-teal-600 dark:text-teal-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {currency} {formatAmount(net)}
                          </td>

                          <td className={`${cellPad} text-center whitespace-nowrap`}>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isOpen
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                                  : isLocked
                                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                                  : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>

                          <td className={`${cellPad} text-xs text-slate-500 dark:text-zinc-400`}>
                            {isClosed ? (
                              <div>
                                <span className="font-mono font-bold text-teal-600 dark:text-teal-400 block">
                                  {p.closingJournalNo || "Swept to 3200 Equity"}
                                </span>
                                <span className="text-[11px]">
                                  {p.closedBy || "Admin"} on{" "}
                                  {p.closedAt
                                    ? new Date(p.closedAt).toLocaleDateString()
                                    : "—"}
                                </span>
                              </div>
                            ) : (p.unpostedJournalsCount || 0) > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                {p.unpostedJournalsCount} unposted journal(s)
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className={`${cellPad} text-right whitespace-nowrap space-x-2`}>
                            <button
                              type="button"
                              onClick={() => setInspectPeriod(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-bold transition-all"
                              title="Inspect Month P&L Breakdown"
                            >
                              <Eye className="w-3.5 h-3.5" /> P&amp;L
                            </button>

                            {isOpen && (
                              <>
                                <button
                                  type="button"
                                  disabled={processing === p.id}
                                  onClick={() => updatePeriodStatus(p, "LOCKED")}
                                  className="px-3 py-1.5 bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold transition-all"
                                >
                                  Lock
                                </button>
                                <button
                                  type="button"
                                  disabled={processing === p.id}
                                  onClick={() => updatePeriodStatus(p, "CLOSED")}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                  {processing === p.id ? "Closing..." : "Close Month"}
                                </button>
                              </>
                            )}

                            {isLocked && (
                              <>
                                <button
                                  type="button"
                                  disabled={processing === p.id}
                                  onClick={() => updatePeriodStatus(p, "OPEN")}
                                  className="px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all"
                                >
                                  Reopen
                                </button>
                                <button
                                  type="button"
                                  disabled={processing === p.id}
                                  onClick={() => updatePeriodStatus(p, "CLOSED")}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                                >
                                  {processing === p.id ? "Closing..." : "Close Month"}
                                </button>
                              </>
                            )}

                            {isClosed && (
                              <button
                                type="button"
                                disabled={processing === p.id}
                                onClick={() => updatePeriodStatus(p, "OPEN")}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-amber-500 hover:text-white text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                {processing === p.id ? "Reopening..." : "Unlock & Reopen"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: INSPECT MONTHLY P&L & RETAINED EARNINGS SWEEP */}
        {inspectPeriod && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                    Monthly Income Statement &amp; Closing Sweep Preview
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {inspectPeriod.name} — P&amp;L Breakdown
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectPeriod(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(inspectPeriod.pnlBreakdown || []).length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No posted Revenue or Expense transactions recorded in {inspectPeriod.name}.
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-3">Account</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Monthly Balance</th>
                          <th className="py-2.5 px-3 text-right">Closing Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                        {(inspectPeriod.pnlBreakdown || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              {item.code} — {item.name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.type === "REVENUE"
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                }`}
                              >
                                {item.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {currency} {formatAmount(item.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[11px] text-slate-500">
                              {item.type === "REVENUE"
                                ? "Debited to 0.00"
                                : "Credited to 0.00"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase block">
                        Permanent Equity Roll-Up (3200 - Retained Earnings)
                      </span>
                      <span className="text-xs text-slate-600 dark:text-zinc-300">
                        Net {Number(inspectPeriod.liveNetProfit || 0) >= 0 ? "Profit (Credit Equity)" : "Loss (Debit Equity)"}
                      </span>
                    </div>
                    <strong className="text-base font-bold text-teal-700 dark:text-teal-300">
                      {currency} {formatAmount(inspectPeriod.liveNetProfit || 0)}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}