"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  ArrowLeft,
  CheckCircle2,
  Plus,
  Zap,
  ArrowLeftRight,
  Lock,
  RotateCcw,
  Trash2,
  Clock,
  Wallet,
  Landmark,
  X,
} from "lucide-react";

type BankTransaction = {
  id: string;
  transactionDate: string;
  reference: string;
  description: string;
  instrumentType: string;
  moneyIn: number;
  moneyOut: number;
  status: string;
};

export default function BankControlPanel() {
  const params = useParams();
  const id = params.id as string;
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [bank, setBank] = useState<any>(null);
  const [allBanks, setAllBanks] = useState<any[]>([]);
  const [depositAccounts, setDepositAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [balances, setBalances] = useState({ cleared: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedToClear, setSelectedToClear] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [tForm, setTForm] = useState({
    destBankId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [dForm, setDForm] = useState({
    creditAccountId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      const [res, allRes, accRes] = await Promise.all([
        fetch(`/api/banking/accounts/${id}`, { cache: "no-store" }),
        fetch(`/api/banking/accounts`, { cache: "no-store" }),
        fetch(`/api/banking/deposit-accounts`, { cache: "no-store" }),
      ]);
      const json = await res.json();
      const allJson = await allRes.json();
      const accJson = await accRes.json();

      if (json.ok) {
        setBank(json.bankAccount);
        setTransactions(json.transactions || []);
        setBalances({
          cleared: Number(json.clearedBalance || 0),
          pending: Number(json.pendingBalance || 0),
          total: Number(json.totalBookBalance || 0),
        });
      }
      if (allJson.ok) setAllBanks(allJson.accounts || []);
      if (accJson.ok) setDepositAccounts(accJson.accounts || []);
    } catch {
      toast.error("Failed to load bank control panel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleBulkClear() {
    if (selectedToClear.length === 0) return;
    setClearing(true);
    try {
      const res = await fetch("/api/banking/transactions/bulk-clear", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedToClear }),
      });
      const json = await res.json();
      if (!res.ok || (json && json.ok === false)) {
        throw new Error(json?.error || "Failed to clear payments.");
      }
      toast.success(`${selectedToClear.length} payment(s) cleared and locked!`);
      setShowClearModal(false);
      setSelectedToClear([]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear payments.");
    } finally {
      setClearing(false);
    }
  }

  async function handleTransfer(e: FormEvent) {
    e.preventDefault();
    setTransferring(true);
    try {
      const res = await fetch("/api/banking/transactions/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tForm, sourceBankId: id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Inter-bank transfer completed!");
      setShowTransfer(false);
      setTForm({
        destBankId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer Failed");
    } finally {
      setTransferring(false);
    }
  }

  async function handleDeposit(e: FormEvent) {
    e.preventDefault();
    setDepositing(true);
    try {
      const res = await fetch("/api/banking/transactions/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dForm, bankAccountId: id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Deposit recorded!");
      setShowDeposit(false);
      setDForm({
        creditAccountId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit Failed");
    } finally {
      setDepositing(false);
    }
  }

  async function handleDeleteTx(txId: string) {
    if (
      !confirm(
        "Are you sure you want to completely delete this transaction? This will automatically VOID any linked Journal Entry."
      )
    )
      return;
    try {
      const res = await fetch(`/api/banking/transactions/${txId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Transaction deleted and Journal Entry voided.");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deletion Failed");
    }
  }

  async function handleReverseTx(txId: string) {
    if (
      !confirm(
        "Are you sure you want to reverse this transaction? This creates an offsetting entry here and fully reverses the debits/credits on the General Ledger."
      )
    )
      return;
    try {
      const res = await fetch(`/api/banking/transactions/${txId}/reverse`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success("Transaction reversed on General Ledger.");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reversal Failed");
    }
  }

  const displayCurrency = bank?.currency || currency || "PKR";
  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  if (loading) {
    return (
      <ERPShell title="Bank Control Panel">
        <div className="py-20 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium">
          Loading Bank Control Panel...
        </div>
      </ERPShell>
    );
  }

  if (!bank) {
    return (
      <ERPShell title="Bank Control Panel">
        <div className="py-20 text-center space-y-3">
          <p className="text-base font-bold text-rose-600 dark:text-rose-400">Bank Account Not Found</p>
          <Link
            href="/accounting/banking"
            className="inline-flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Bank Directory
          </Link>
        </div>
      </ERPShell>
    );
  }

  const pendingTxs = transactions.filter((t) => t.status === "PENDING");

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title={`${bank.bankName} — Control Panel`}>
        <div className="space-y-6 relative z-10">
          {/* Top Header & Actions Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <Link
                href="/accounting/banking"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Bank Directory
              </Link>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {bank.bankName} — {bank.accountTitle}
              </h2>
              <p className="font-mono text-xs text-slate-500 dark:text-zinc-400 mt-1">
                A/C: {bank.accountNumber} {bank.iban ? `| IBAN: ${bank.iban}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Clear Payments
                {pendingTxs.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px]">
                    {pendingTxs.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowDeposit(true)}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Quick Deposit
              </button>

              <Link
                href={`/accounting/banking/${id}/reconcile`}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-4 h-4 text-amber-500" /> Reconcile CSV
              </Link>

              <button
                type="button"
                onClick={() => setShowTransfer(true)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/80 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <ArrowLeftRight className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Transfer Funds
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  Cleared Balance (Available)
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {displayCurrency} {formatAmount(balances.cleared)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Uncleared / Pending
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {displayCurrency} {formatAmount(balances.pending)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Total Subledger Balance
                </span>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1.5">
                  {displayCurrency} {formatAmount(balances.total)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Subledger Transactions Table */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Landmark className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bank Statement &amp; Subledger Transactions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    All deposits, loan inflows, supplier payouts, and inter-bank transfers for this account.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Date</th>
                    <th className={cellPad}>Reference</th>
                    <th className={cellPad}>Description</th>
                    <th className={`${cellPad} text-right text-emerald-600 dark:text-emerald-400`}>
                      In (Dr)
                    </th>
                    <th className={`${cellPad} text-right text-rose-600 dark:text-rose-400`}>
                      Out (Cr)
                    </th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-sm text-slate-400 dark:text-zinc-500">
                        No transactions recorded for this bank account yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className={`${cellPad} text-slate-600 dark:text-zinc-300 whitespace-nowrap`}>
                          {new Date(tx.transactionDate).toISOString().slice(0, 10)}
                        </td>
                        <td className={`${cellPad} font-mono text-xs font-bold text-slate-800 dark:text-zinc-200`}>
                          {tx.reference || "—"}
                        </td>
                        <td className={`${cellPad} text-slate-700 dark:text-zinc-300`}>{tx.description}</td>
                        <td className={`${cellPad} text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap`}>
                          {Number(tx.moneyIn) > 0 ? `${displayCurrency} ${formatAmount(tx.moneyIn)}` : "—"}
                        </td>
                        <td className={`${cellPad} text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap`}>
                          {Number(tx.moneyOut) > 0 ? `${displayCurrency} ${formatAmount(tx.moneyOut)}` : "—"}
                        </td>
                        <td className={`${cellPad} text-center whitespace-nowrap`}>
                          {tx.status === "CLEARED" || tx.status === "RECONCILED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                              <Lock className="w-3 h-3" /> {tx.status}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                              {tx.status}
                            </span>
                          )}
                        </td>
                        <td className={`${cellPad} text-right whitespace-nowrap`}>
                          <div className="inline-flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleReverseTx(tx.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-400 text-[11px] font-bold transition-all"
                            >
                              <RotateCcw className="w-3 h-3" /> Reverse
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-[11px] font-bold transition-all"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
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

        {/* MODAL 1: QUICK DEPOSIT */}
        {showDeposit && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Deposit</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Record direct funds received into {bank.bankName}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeposit(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDeposit} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Account to Credit (Source of Funds) *
                  </label>
                  <select
                    required
                    value={dForm.creditAccountId}
                    onChange={(e) => setDForm({ ...dForm, creditAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Select GL Account --</option>
                    {depositAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Deposit Amount ({displayCurrency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={dForm.amount}
                    onChange={(e) => setDForm({ ...dForm, amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={dForm.date}
                    onChange={(e) => setDForm({ ...dForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Description *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Owner Capital Injection"
                    value={dForm.description}
                    onChange={(e) => setDForm({ ...dForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowDeposit(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={depositing}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {depositing ? "Processing..." : "Record Deposit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: CLEAR PENDING PAYMENTS */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
              <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Clear Pending Payments</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Select the transactions you have verified on your bank statement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 dark:bg-zinc-950 sticky top-0 border-b border-slate-200 dark:border-white/10 z-10">
                    <tr className="text-[10px] uppercase text-slate-500 dark:text-zinc-400 font-bold">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded accent-teal-500 cursor-pointer"
                          onChange={(e) =>
                            setSelectedToClear(e.target.checked ? pendingTxs.map((t) => t.id) : [])
                          }
                          checked={pendingTxs.length > 0 && selectedToClear.length === pendingTxs.length}
                        />
                      </th>
                      <th className="py-3 px-4">Date &amp; Ref</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {pendingTxs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                          No pending transactions available to clear.
                        </td>
                      </tr>
                    ) : (
                      pendingTxs.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-teal-50/40 dark:hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() =>
                            setSelectedToClear((prev) =>
                              prev.includes(tx.id) ? prev.filter((item) => item !== tx.id) : [...prev, tx.id]
                            )
                          }
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedToClear.includes(tx.id)}
                              readOnly
                              className="w-4 h-4 rounded accent-teal-500 pointer-events-none"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{tx.reference || "—"}</div>
                            <div className="text-xs text-slate-500 dark:text-zinc-400">
                              {new Date(tx.transactionDate).toISOString().slice(0, 10)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 text-xs">{tx.description}</td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              tx.moneyIn > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {tx.moneyIn > 0
                              ? `+ ${displayCurrency} ${formatAmount(tx.moneyIn)}`
                              : `- ${displayCurrency} ${formatAmount(tx.moneyOut)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-zinc-950/50 flex justify-between items-center">
                <div className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                  {selectedToClear.length} selected
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowClearModal(false)}
                    className="px-5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkClear}
                    disabled={clearing || selectedToClear.length === 0}
                    className="px-5 py-2 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition-all shadow-lg shadow-teal-500/20"
                  >
                    {clearing ? "Locking..." : "Clear & Lock"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: INTER-BANK TRANSFER */}
        {showTransfer && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inter-Bank Transfer</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Transfer funds from {bank.bankName} to another bank account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransfer(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Transfer To (Destination Bank) *
                  </label>
                  <select
                    required
                    value={tForm.destBankId}
                    onChange={(e) => setTForm({ ...tForm, destBankId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Select Bank Account --</option>
                    {allBanks
                      .filter((b) => b.id !== id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bankName} ({b.accountNumber})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Amount to Transfer ({displayCurrency}) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={tForm.amount}
                    onChange={(e) => setTForm({ ...tForm, amount: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Transfer Date *
                  </label>
                  <input
                    required
                    type="date"
                    value={tForm.date}
                    onChange={(e) => setTForm({ ...tForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Reference / Description
                  </label>
                  <input
                    type="text"
                    placeholder="Optional transfer memo"
                    value={tForm.description}
                    onChange={(e) => setTForm({ ...tForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowTransfer(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={transferring}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {transferring ? "Processing..." : "Confirm Transfer"}
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