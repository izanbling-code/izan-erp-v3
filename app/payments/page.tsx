"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Flame,
  Landmark,
  CheckCircle2,
  Lock,
  RefreshCw,
  Trash2,
  ShieldCheck,
  X,
} from "lucide-react";

type Mode = "receive" | "supplier" | "expense" | "deposit";

const options: Array<{
  mode: Mode;
  title: string;
  code: string;
  description: string;
  icon: any;
  accent: string;
  btnText: string;
}> = [
  {
    mode: "receive",
    title: "Sales Payment Receipts",
    code: "RE-xxxx",
    description:
      "Receive customer payments against single or multiple sales invoices via Cash Book, Online Bank, or Cheque.",
    icon: ArrowDownLeft,
    accent:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    btnText: "Open Sales Receipts",
  },
  {
    mode: "supplier",
    title: "Supplier Bill Payments",
    code: "PV-xxxx",
    description:
      "Pay suppliers against single or multiple purchase bills via Cash Book, Online Bank Transfer, or Cheque.",
    icon: ArrowUpRight,
    accent:
      "bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
    btnText: "Open Supplier Payments",
  },
  {
    mode: "expense",
    title: "Expense Vouchers",
    code: "EV-xxxx",
    description:
      "Record Cost of Sales, Operating Expenses, and Finance Expenses or create new Expense Heads on the fly.",
    icon: Flame,
    accent:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    btnText: "Open Expense Module",
  },
  {
    mode: "deposit",
    title: "Direct Fund Deposits",
    code: "DP-xxxx",
    description:
      "Directly deposit capital injections or miscellaneous funds into your active Cash Book or Bank Directory.",
    icon: Landmark,
    accent:
      "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    btnText: "Open Direct Deposit",
  },
];

export default function PaymentsPage() {
  const router = useRouter();
  const { formatAmount, currency } = useERPConfig();

  const [unpostedVouchers, setUnpostedVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(true);
  const [showApprovalBox, setShowApprovalBox] = useState(false);

  async function loadPendingApprovals() {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("PaymentVoucher")
        .select("*")
        .eq("status", "UNPOSTED")
        .order("paymentDate", { ascending: false });
      setUnpostedVouchers(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Payments & Treasury Hub">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Treasury, Cheques &amp; Voucher Control
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Payments &amp; Direct Deposits Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Select a dedicated payment module below. Each module opens in isolated mode with full JE/Voucher audit tracing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCanApprove((prev) => !prev)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950 text-[11px] font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1.5"
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 ${canApprove ? "text-teal-500" : "text-slate-400"}`}
                />
                Role: {canApprove ? "Admin / Approver" : "Standard User"}
              </button>

              {canApprove && (
                <button
                  type="button"
                  onClick={() => setShowApprovalBox(true)}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Voucher Approval Box
                  <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">
                    {unpostedVouchers.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={loadPendingApprovals}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 text-xs font-bold"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-teal-500" : ""}`} />
              </button>
            </div>
          </div>

          {/* 4 Isolated Mode Launch Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => router.push(`/payments/${option.mode}`)}
                  className="group text-left bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/10 hover:border-teal-500/50 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 cursor-pointer"
                >
                  <div className="flex items-start justify-between w-full">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 ${option.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400">
                      {option.code}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      {option.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {option.description}
                    </p>
                  </div>

                  <div className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    {option.btnText} &rarr;
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MODAL: CENTRAL APPROVAL BOX (ONLY VISIBLE WHEN BUTTON IS CLICKED BY ADMIN/APPROVER) */}
        {showApprovalBox && canApprove && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Central Voucher Approval Box
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Click any pending voucher to open its module and approve/post it to the General Ledger.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApprovalBox(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-[10px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3">Voucher No</th>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Debit &rarr; Credit</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {unpostedVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        All caught up! No unposted vouchers waiting for approval.
                      </td>
                    </tr>
                  ) : (
                    unpostedVouchers.map((v) => (
                      <tr key={v.id}>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {v.voucherNo}
                        </td>
                        <td className="py-3 px-3 uppercase font-bold text-teal-600">
                          {v.mode} ({v.method})
                        </td>
                        <td className="py-3 px-3">
                          <div>Dr: {v.debitAccountName}</div>
                          <div className="text-slate-500">Cr: {v.creditAccountName}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {currency} {formatAmount(v.amount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setShowApprovalBox(false);
                              router.push(`/payments/${v.mode}`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold"
                          >
                            Review in Module &rarr;
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}