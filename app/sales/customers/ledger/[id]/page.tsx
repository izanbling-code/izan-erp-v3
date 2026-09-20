"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function CustomerLedgerPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/ledger?id=${id}`).then(r => r.json()).then(j => {
      if (j.ok) setData(j);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-20 text-center text-gray-500 font-bold animate-pulse">Loading Ledger Statement...</div>;
  if (!data) return <div className="p-20 text-center text-rose-500 font-bold">Failed to load ledger.</div>;

  const customer = data.customer;
  const openingBalance = Number(customer.openingBalance || 0);
  let runningBalance = openingBalance;

  // Calculate final balances dynamically (Debit increases AR, Credit decreases AR)
  const transactions = data.transactions.map((tx: any) => {
    runningBalance = runningBalance + tx.debit - tx.credit;
    return { ...tx, balance: runningBalance };
  });

  const totalInvoiced = transactions.reduce((sum: number, tx: any) => sum + tx.debit, 0);
  const totalReceived = transactions.reduce((sum: number, tx: any) => sum + tx.credit, 0);

  const formatMoney = (amt: number) => `₨ ${amt.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-end bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <Link href="/sales/customers" className="text-indigo-600 font-bold text-sm mb-3 inline-block hover:underline">&larr; Back to Directory</Link>
          <h1 className="text-3xl font-black text-gray-900">{customer.name}</h1>
          <p className="text-gray-500 font-medium mt-1">Customer Statement of Account</p>
          <div className="flex gap-4 mt-4 text-sm text-gray-600">
            {customer.phone && <div><span className="font-bold text-gray-400">TEL:</span> {customer.phone}</div>}
            {customer.taxNumber && <div><span className="font-bold text-gray-400">TAX:</span> {customer.taxNumber}</div>}
          </div>
        </div>
        <button onClick={() => window.print()} className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-black transition print:hidden">🖨️ Print Statement</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Opening Balance</p><p className="text-xl font-bold text-gray-900">{formatMoney(openingBalance)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Invoiced (Dr)</p><p className="text-xl font-bold text-gray-900">{formatMoney(totalInvoiced)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Received (Cr)</p><p className="text-xl font-bold text-emerald-600">{formatMoney(totalReceived)}</p></div>
        <div className="bg-gray-900 p-5 rounded-xl shadow-md"><p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Current Receivable</p><p className="text-2xl font-black text-white">{formatMoney(runningBalance)}</p></div>
      </div>

      {/* LEDGER TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="erp-data-table">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase text-gray-500 font-black tracking-wider">
              <th className="py-4 px-6">Date</th><th className="py-4 px-6">Reference</th><th className="py-4 px-6">Description</th>
              <th className="py-4 px-6 text-right text-rose-700">Invoice (Debit)</th>
              <th className="py-4 px-6 text-right text-emerald-700">Receipt (Credit)</th>
              <th className="py-4 px-6 text-right text-gray-900">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            
            {/* Opening Balance Row */}
            {openingBalance > 0 && (
              <tr className="bg-gray-50/50">
                <td colSpan={3} className="py-4 px-6 text-gray-500 font-bold italic text-right">Opening Balance Forwarded &rarr;</td>
                <td className="py-4 px-6 text-right font-bold text-gray-500">{formatMoney(openingBalance)}</td><td className="py-4 px-6"></td><td className="py-4 px-6 text-right font-black text-gray-900">{formatMoney(openingBalance)}</td>
              </tr>
            )}

            {/* Transactions */}
            {transactions.map((tx: any) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition">
                <td className="py-4 px-6 text-gray-600">{new Date(tx.date).toISOString().slice(0,10)}</td>
                <td className="py-4 px-6 font-bold text-gray-900">{tx.reference}</td>
                <td className="py-4 px-6 text-gray-600">{tx.description}</td>
                <td className="py-4 px-6 text-right text-rose-600 font-bold">{tx.debit > 0 ? formatMoney(tx.debit) : "-"}</td>
                <td className="py-4 px-6 text-right text-emerald-600 font-bold">{tx.credit > 0 ? formatMoney(tx.credit) : "-"}</td>
                <td className="py-4 px-6 text-right font-black text-gray-900">{formatMoney(tx.balance)}</td>
              </tr>
            ))}

            {transactions.length === 0 && (
              <tr><td colSpan={6} className="py-16 text-center text-gray-400 font-bold">No transactions found for this customer.</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}