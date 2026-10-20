"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ChevronLeft, Loader2 } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { supabase } from "@/app/lib/supabase";

export default function CourierLedgerPrintPage() {
  const params = useParams();
  const { formatAmount, currency } = useERPConfig("general");
  
  const [courier, setCourier] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!params.id) return;
      
      try {
        setLoading(true);
        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        
        const [cData, iData, pData] = await Promise.all([
          supabase.from("Courier").select("*").eq("id", params.id).single(),
          supabase.from("SalesInvoice").select(`*, customer:Customer(name)`).eq("companyId", company?.id).eq("courierId", params.id),
          supabase.from("CourierPayment").select("*").eq("companyId", company?.id).eq("courierId", params.id)
        ]);

        if (cData.data) setCourier(cData.data);

        const invoices = iData.data || [];
        const payments = pData.data || [];
        let entries: any[] = [];

        // Build Ledger
        invoices.forEach(inv => {
          entries.push({
            date: new Date(inv.invoiceDate),
            description: `Invoice Booked - COD (${inv.invoiceNo})`,
            ref: inv.invoiceNo,
            debit: Number(inv.total),
            credit: 0,
          });
          entries.push({
            date: new Date(inv.invoiceDate),
            description: `Delivery Charges (${inv.invoiceNo})`,
            ref: inv.invoiceNo,
            debit: 0,
            credit: Number(inv.deliveryCharges),
          });
        });

        payments.forEach(pmt => {
          entries.push({
            date: new Date(pmt.date),
            description: `Payment Received`,
            ref: pmt.reference || "PMT",
            debit: 0,
            credit: Number(pmt.amountReceived),
          });
          if (Number(pmt.taxDeducted) > 0) {
            entries.push({
              date: new Date(pmt.date),
              description: `W.H. Tax Deducted`,
              ref: pmt.reference || "TAX",
              debit: 0,
              credit: Number(pmt.taxDeducted),
            });
          }
        });

        entries.sort((a, b) => a.date.getTime() - b.date.getTime());

        let runningBalance = 0;
        const finalLedger = entries.map(entry => {
          runningBalance += (entry.debit - entry.credit);
          return { ...entry, runningBalance };
        });

        setLedger(finalLedger);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [params.id]);

  if (loading) return <div className="min-h-screen bg-slate-200 flex items-center justify-center"><div className="animate-pulse text-teal-600 font-bold tracking-widest">LOADING LEDGER...</div></div>;
  if (!courier) return <div className="min-h-screen bg-slate-200 flex items-center justify-center flex-col gap-4"><h1 className="text-2xl font-bold text-slate-800">Courier Not Found</h1><Link href="/couriers" className="text-teal-600 underline">Go back</Link></div>;

  const totalDebit = ledger.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = ledger.reduce((sum, r) => sum + r.credit, 0);
  const finalBalance = totalDebit - totalCredit;

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white text-slate-900 font-sans flex flex-col items-center">
      <style dangerouslySetInnerHTML={{__html: `@media print { @page { size: A4; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}} />

      {/* Control Bar */}
      <div className="print:hidden w-full bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        <Link href="/couriers" className="flex items-center gap-2 text-slate-300 hover:text-teal-400 transition-colors font-semibold text-sm">
          <ChevronLeft className="w-5 h-5" /> Back to Couriers
        </Link>
        <button onClick={() => window.print()} className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all">
          <Printer className="w-4 h-4" /> Print Ledger
        </button>
      </div>

      {/* A4 Paper Container */}
      <div className="p-8 print:p-0 flex justify-center w-full overflow-x-auto pb-20">
        <div className="w-[210mm] min-h-[297mm] print:w-full print:min-h-screen bg-white text-zinc-900 p-[15mm] print:p-[10mm] shadow-2xl print:shadow-none font-sans text-sm mx-auto flex flex-col shrink-0">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-4 border-b-2 border-zinc-900">
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase">Izan Bling</h1>
              <p className="text-zinc-500 text-sm mt-1">Courier Statement</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-zinc-800">{courier.name}</h2>
              {courier.phone && <p className="text-zinc-500 text-sm mt-1">{courier.phone}</p>}
              <p className="text-zinc-900 font-bold text-sm mt-2">As of: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-100">
                  <th className="p-3 font-bold uppercase tracking-wider">Date</th>
                  <th className="p-3 font-bold uppercase tracking-wider">Description</th>
                  <th className="p-3 font-bold uppercase tracking-wider">Reference</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">Debit</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">Credit</th>
                  <th className="p-3 font-bold uppercase tracking-wider text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {ledger.map((row, i) => (
                  <tr key={i}>
                    <td className="p-3 text-zinc-600">{row.date.toISOString().slice(0, 10)}</td>
                    <td className="p-3 font-medium text-zinc-900">{row.description}</td>
                    <td className="p-3 font-mono text-zinc-500">{row.ref}</td>
                    <td className="p-3 text-right font-mono text-zinc-800">{row.debit > 0 ? formatAmount(row.debit) : "—"}</td>
                    <td className="p-3 text-right font-mono text-zinc-800">{row.credit > 0 ? formatAmount(row.credit) : "—"}</td>
                    <td className="p-3 text-right font-bold font-mono text-zinc-900">{formatAmount(row.runningBalance)}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-zinc-500">No transactions found.</td></tr>
                )}
              </tbody>  
            </table>
          </div>

          {/* Footer Summary */}
          <div className="mt-8 pt-4 border-t-2 border-zinc-900 flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-zinc-700">
                <span>Total Debit:</span>
                <span className="font-mono">{currency} {formatAmount(totalDebit)}</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-700">
                <span>Total Credit:</span>
                <span className="font-mono">{currency} {formatAmount(totalCredit)}</span>
              </div>
              <div className="flex justify-between font-black text-lg border-t border-zinc-300 pt-2 mt-2">
                <span>Closing Balance:</span>
                <span className="font-mono">{currency} {formatAmount(finalBalance)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}