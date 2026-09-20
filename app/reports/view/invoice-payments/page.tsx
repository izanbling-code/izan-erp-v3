"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

export default function InvoicePaymentsReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/invoice-payments").then(r => r.json()).then(j => { if (j.ok) setData(j.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);

  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <Link href="/reports" className="text-sm font-bold text-gray-500 hover:text-gray-800 mb-2 inline-block">&larr; Back to Reports</Link>
            <h1 className="text-2xl font-bold text-gray-900">Sales Invoice Payments</h1>
            <p className="text-sm text-gray-500 mt-1">Tracks total amounts received against customer invoices and identifies destination accounts.</p>
          </div>
          <button onClick={() => window.print()} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm transition">🖨️ Print Report</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? ( <div className="text-center py-20 text-gray-400 font-bold">Querying Ledger Database...</div> ) : (
            <div className="overflow-x-auto">
              <table className="erp-data-table">
                <thead className="bg-gray-50 border-b"><tr className="text-[11px] uppercase text-gray-500 font-bold"><th className="py-3 px-4">Date</th><th className="py-3 px-4">Receipt #</th><th className="py-3 px-4">Customer</th><th className="py-3 px-4">Invoice #</th><th className="py-3 px-4">Destination Account</th><th className="py-3 px-4 text-right">Amount Received</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {data.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-400">No invoice payments recorded.</td></tr> : data.map((row: any) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-4 text-gray-600">{new Date(row.date).toISOString().slice(0, 10)}</td>
                      <td className="py-3 px-4 font-bold font-mono text-gray-900">{row.paymentNo}</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">{row.customerName}</td>
                      <td className="py-3 px-4 text-gray-700 font-mono text-xs">{row.invoiceNo}</td>
                      <td className="py-3 px-4 text-indigo-700 font-medium">{row.destinationAccount}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(row.amountPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ERPShell>
  );
}