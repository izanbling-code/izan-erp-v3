"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

export default function CashBookReport() {
  const [data, setData] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterAccount, setFilterAccount] = useState("default");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => { runReport(); }, []);

  async function runReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAccount !== "default") params.append("accountId", filterAccount);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/reports/cash-book?${params.toString()}`);
      const j = await res.json();
      if (j.ok) {
        setData(j.data); setOpeningBalance(j.openingBalance);
        if (accounts.length === 0) setAccounts(j.accounts);
        if (filterAccount === "default" && j.selectedAccount) setFilterAccount(j.selectedAccount.id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Math.abs(amt));

  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <Link href="/reports" className="text-sm font-bold text-gray-500 hover:text-gray-800 mb-2 inline-block print:hidden">&larr; Back to Reports</Link>
            <h1 className="text-2xl font-bold text-gray-900">Cash Book Register</h1>
            <p className="text-sm text-gray-500 mt-1">Simple register tracking business transactions, voucher IDs, and running cash balances.</p>
          </div>
          <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm transition print:hidden">🖨️ Print Report</button>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end print:hidden">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select Cash Account</label>
            <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="border rounded-md p-2.5 bg-gray-50 outline-none text-sm font-medium">
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-md p-2.5 bg-gray-50 outline-none text-sm font-medium" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-md p-2.5 bg-gray-50 outline-none text-sm font-medium" />
          </div>
          <button onClick={runReport} disabled={loading} className="px-6 py-2.5 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50">
            {loading ? "Running..." : "Run Report"}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? ( <div className="text-center py-20 text-gray-400 font-bold">Querying Register...</div> ) : (
            <div className="overflow-x-auto">
              <table className="erp-data-table">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] uppercase text-gray-500 font-bold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Voucher ID</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  
                  <tr className="bg-gray-50/50">
                    <td colSpan={5} className="py-3 px-4 font-bold text-gray-600 text-right">Opening Balance</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(openingBalance)}</td>
                  </tr>

                  {data.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">No cash transactions found.</td></tr> : data.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(row.date).toISOString().slice(0, 10)}</td>
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{row.type}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-700">{row.voucherId}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs truncate max-w-[200px]">{row.description}</td>
                      <td className={`py-3 px-4 text-right font-bold ${row.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.amount >= 0 ? "" : "-"} {formatCurrency(row.amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}

                  {data.length > 0 && (
                    <tr className="bg-gray-100 border-t-2 border-gray-200">
                      <td colSpan={5} className="py-4 px-4 font-bold text-gray-800 text-right uppercase tracking-wider text-xs">Closing Balance</td>
                      <td className="py-4 px-4 text-right font-black text-indigo-900 text-base">{formatCurrency(data[data.length - 1].balance)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ERPShell>
  );
}