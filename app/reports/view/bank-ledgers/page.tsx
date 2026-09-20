"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

export default function BankLedgerReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/bank-ledgers").then(r => r.json()).then(j => { if (j.ok) setData(j.banks); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);

  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <Link href="/reports" className="text-sm font-bold text-gray-500 hover:text-gray-800 mb-2 inline-block">&larr; Back to Reports</Link>
            <h1 className="text-2xl font-bold text-gray-900">Bank Ledgers</h1>
            <p className="text-sm text-gray-500 mt-1">Chronological statements and running balances for all registered bank accounts.</p>
          </div>
          <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm transition">🖨️ Print Report</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {loading ? ( <div className="text-center py-20 text-gray-400 font-bold">Querying Ledger Database...</div> ) : (
            <div className="space-y-8">
              {data.length === 0 ? <div className="text-center py-8 text-gray-400">No bank accounts registered.</div> : data.map((bank: any) => (
                <div key={bank.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center"><h4 className="font-bold">{bank.bankName} — {bank.accountTitle} ({bank.accountNumber})</h4><span className="text-xs font-mono">IBAN: {bank.iban || "N/A"}</span></div>
                  <div className="overflow-x-auto">
                    <table className="erp-data-table">
                      <thead className="bg-gray-50 border-b"><tr className="text-[11px] uppercase text-gray-500 font-bold"><th className="py-2 px-4">Date</th><th className="py-2 px-4">Ref</th><th className="py-2 px-4">Description</th><th className="py-2 px-4 text-right text-emerald-700">In (Dr)</th><th className="py-2 px-4 text-right text-rose-700">Out (Cr)</th><th className="py-2 px-4 text-center">Status</th></tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {bank.transactions.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-gray-400">No transactions in this ledger.</td></tr> : bank.transactions.map((tx: any) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="py-2 px-4 text-gray-600">{new Date(tx.transactionDate).toISOString().slice(0, 10)}</td>
                            <td className="py-2 px-4 font-bold">{tx.reference || "—"}</td>
                            <td className="py-2 px-4 text-gray-700">{tx.description}</td>
                            <td className="py-2 px-4 text-right text-emerald-600 font-semibold">{tx.moneyIn > 0 ? formatCurrency(tx.moneyIn) : "—"}</td>
                            <td className="py-2 px-4 text-right text-rose-600 font-semibold">{tx.moneyOut > 0 ? formatCurrency(tx.moneyOut) : "—"}</td>
                            <td className="py-2 px-4 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">{tx.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ERPShell>
  );
}