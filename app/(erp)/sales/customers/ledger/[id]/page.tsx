"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  ArrowLeft,
  Printer,
  Scale,
  TrendingUp,
  TrendingDown,
  Wallet,
  Phone,
  Hash,
  BookOpen,
} from "lucide-react";

export default function CustomerLedgerPage() {
  const { id } = useParams();
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/ledger?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ERPShell title="Customer Ledger">
        <div className="py-20 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium">
          Loading Customer Ledger Statement...
        </div>
      </ERPShell>
    );
  }

  if (!data) {
    return (
      <ERPShell title="Customer Ledger">
        <div className="py-20 text-center space-y-3">
          <p className="text-base font-bold text-rose-600 dark:text-rose-400">
            Failed to load customer ledger.
          </p>
          <Link
            href="/sales/customers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Customers Directory
          </Link>
        </div>
      </ERPShell>
    );
  }

  const customer = data.customer;
  const openingBalance = Number(customer.openingBalance || 0);
  let runningBalance = openingBalance;

  // Calculate final balances dynamically (Debit increases AR, Credit decreases AR)
  const transactions = (data.transactions || []).map((tx: any) => {
    runningBalance = runningBalance + Number(tx.debit || 0) - Number(tx.credit || 0);
    return { ...tx, balance: runningBalance };
  });

  const totalInvoiced = transactions.reduce(
    (sum: number, tx: any) => sum + Number(tx.debit || 0),
    0
  );
  const totalReceived = transactions.reduce(
    (sum: number, tx: any) => sum + Number(tx.credit || 0),
    0
  );

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <ERPShell title={`${customer.name} — Ledger`}>
      <div className="space-y-6 relative z-10">
        {/* Header Bar */}
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              href="/sales/customers"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-2 print:hidden"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Customers Directory
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {customer.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Customer Statement of Account &amp; Receivable Running Balance
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-zinc-300">
              {customer.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <strong>TEL:</strong> {customer.phone}
                </span>
              )}
              {customer.taxNumber && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Hash className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <strong>TAX / NTN:</strong> {customer.taxNumber}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all print:hidden shrink-0"
          >
            <Printer className="w-4 h-4" /> Print Statement
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                Opening Balance
              </span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                {currency} {formatAmount(openingBalance)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-400">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                Total Invoiced (Dr)
              </span>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
                {currency} {formatAmount(totalInvoiced)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Total Received (Cr)
              </span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                {currency} {formatAmount(totalReceived)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-teal-200/80 dark:border-teal-500/20 p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Current Receivable
              </span>
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1.5">
                {currency} {formatAmount(runningBalance)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Ledger Table Card */}
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
          <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Chronological Ledger Transactions
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Complete audit trail of customer invoices (Dr) and payment receipts (Cr).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                  <th className={cellPad}>Date</th>
                  <th className={cellPad}>Reference</th>
                  <th className={cellPad}>Description</th>
                  <th className={`${cellPad} text-right text-rose-600 dark:text-rose-400`}>
                    Invoice (Debit)
                  </th>
                  <th className={`${cellPad} text-right text-emerald-600 dark:text-emerald-400`}>
                    Receipt (Credit)
                  </th>
                  <th className={`${cellPad} text-right`}>Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {openingBalance > 0 && (
                  <tr className="bg-slate-50/60 dark:bg-zinc-950/40">
                    <td
                      colSpan={3}
                      className={`${cellPad} text-slate-500 dark:text-zinc-400 font-bold italic text-right`}
                    >
                      Opening Balance Forwarded &rarr;
                    </td>
                    <td className={`${cellPad} text-right font-bold text-slate-600 dark:text-zinc-300`}>
                      {currency} {formatAmount(openingBalance)}
                    </td>
                    <td className={cellPad}></td>
                    <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white`}>
                      {currency} {formatAmount(openingBalance)}
                    </td>
                  </tr>
                )}

                {transactions.map((tx: any) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className={`${cellPad} text-slate-600 dark:text-zinc-300 whitespace-nowrap`}>
                      {new Date(tx.date).toISOString().slice(0, 10)}
                    </td>
                    <td className={`${cellPad} font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                      {tx.reference || "—"}
                    </td>
                    <td className={`${cellPad} text-slate-700 dark:text-zinc-300`}>
                      {tx.description}
                    </td>
                    <td className={`${cellPad} text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap`}>
                      {Number(tx.debit) > 0
                        ? `${currency} ${formatAmount(tx.debit)}`
                        : "—"}
                    </td>
                    <td className={`${cellPad} text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}>
                      {Number(tx.credit) > 0
                        ? `${currency} ${formatAmount(tx.credit)}`
                        : "—"}
                    </td>
                    <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                      {currency} {formatAmount(tx.balance)}
                    </td>
                  </tr>
                ))}

                {transactions.length === 0 && openingBalance === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500 font-medium"
                    >
                      No transactions found for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ERPShell>
  );
}