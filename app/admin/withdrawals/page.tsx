"use client";

import { useEffect, useState, FormEvent } from "react";
import ERPShell from "@/app/components/erp-shell";

type Withdrawal = { id: string; entryNumber: string; date: string; amount: number; sourceAccount: string; description: string; };
type Account = { id: string; name: string; systemCode: string; };

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sourceAccountId: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });

  async function loadData() {
    setLoading(true);
    try {
      const [wRes, aRes] = await Promise.all([
        fetch("/api/admin/withdrawals", { cache: "no-store" }),
        fetch("/api/accounting/cashbook/accounts", { cache: "no-store" }) // Reuse Cashbook accounts fetcher
      ]);
      const wJson = await wRes.json();
      const aJson = await aRes.json();
      
      if (wJson.ok) setWithdrawals(wJson.withdrawals || []);
      if (aJson.ok) setAccounts(aJson.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleWithdrawal(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      setShowModal(false);
      setForm({ sourceAccountId: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record withdrawal.");
    } finally {
      setSubmitting(false);
    }
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 2 }).format(amt);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  return (
    <ERPShell title="Owner Withdrawals">
      <div className="max-w-6xl mx-auto p-6 space-y-6 text-sm">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Owner Distributions & Withdrawals</h1>
            <p className="text-gray-500 mt-1">Manage profit withdrawals drawn from business equity.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-rose-700 hover:bg-rose-800 text-white font-bold py-2.5 px-5 rounded-lg transition shadow-sm">
            - Record Withdrawal
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-800 flex flex-col justify-center max-w-sm">
          <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Total Lifetime Distributions</div>
          <div className="text-3xl font-bold text-white tracking-tight">{formatCurrency(totalWithdrawn)}</div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700">Withdrawal History</div>
          <table className="erp-data-table">
            <thead>
              <tr className="border-b text-[11px] uppercase text-gray-500 font-bold bg-white">
                <th className="py-3 px-4">Voucher</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Source Account (Asset)</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right">Amount Drawn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-[13px]">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading records...</td></tr>
              ) : withdrawals.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">No withdrawals recorded yet.</td></tr>
              ) : (
                withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4 text-rose-700 font-bold">{w.entryNumber}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(w.date).toISOString().slice(0, 10)}</td>
                    <td className="py-3 px-4 text-gray-900 font-semibold">{w.sourceAccount}</td>
                    <td className="py-3 px-4 text-gray-600">{w.description}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(w.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WITHDRAWAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-rose-700 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Record Owner Withdrawal</h2>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleWithdrawal} className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-medium mb-4">
                ⚠️ This will permanently deduct funds from the selected asset and reduce business equity (Retained Earnings).
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700">Withdraw From (Cash/Bank) *</span>
                <select required value={form.sourceAccountId} onChange={(e) => setForm({...form, sourceAccountId: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none">
                  <option value="">-- Select Source Account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700">Amount (PKR) *</span>
                <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none font-bold text-rose-600" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700">Description / Memo</span>
                <input required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="e.g., Monthly Profit Distribution" className="border rounded-md p-2.5 bg-gray-50 outline-none" />
              </label>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-lg font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50">
                  {submitting ? "Processing..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ERPShell>
  );
}