"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

export default function CashDepositReport() {
  const [data, setData] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [filterBank, setFilterBank] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    // Preload bank options for the dropdown
    fetch("/api/reports/bank-ledgers").then(r => r.json()).then(j => { 
      if (j.ok) setBanks(j.banks || []); 
    });
    runReport(); // Run initial unrestricted report
  }, []);

  async function runReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterBank !== "all") params.append("bankId", filterBank);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/reports/cash-deposits?${params.toString()}`);
      const j = await res.json();
      if (j.ok) setData(j.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);
  const totalDeposits = data.reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* HEADER SECTION */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <Link href="/reports" className="text-sm font-bold text-gray-500 hover:text-gray-800 mb-2 inline-block print:hidden">&larr; Back to Reports</Link>
            <h1 className="text-2xl font-bold text-gray-900">Cash Deposit Report</h1>
            <p className="text-sm text-gray-500 mt-1">Tracks all funds transferred into bank accounts and identifies their source account.</p>
          </div>
          <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm transition print:hidden">🖨️ Print Report</button>
        </div>

        {/* FILTER CONTROL BAR (Hidden during print) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end print:hidden">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Select Account</label>
            <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)} className="border rounded-md p-2.5 bg-gray-50 outline-none text-sm font-medium">
              <option value="all">All Deposits</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.bankName} - {b.accountTitle}</option>
              ))}
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

        {/* REPORT DATA TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? ( <div className="text-center py-20 text-gray-400 font-bold">Querying Ledger Database...</div> ) : (
            <div className="overflow-x-auto">
              <table className="erp-data-table">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-[11px] uppercase text-gray-500 font-bold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Destination Bank</th>
                    <th className="py-3 px-4">Source Account (Cr)</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount Deposited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">No cash deposits found for this filter.</td></tr> : data.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-600">{new Date(row.date).toISOString().slice(0, 10)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{row.bankName}</td>
                      <td className="py-3 px-4 font-semibold text-indigo-700">{row.sourceAccount}</td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{row.reference}</td>
                      <td className="py-3 px-4 text-gray-600">{row.description}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  {data.length > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="py-4 px-4 text-right font-bold text-gray-700 uppercase text-xs tracking-wider">Total for Period:</td>
                      <td className="py-4 px-4 text-right font-black text-emerald-700 text-base">{formatCurrency(totalDeposits)}</td>
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