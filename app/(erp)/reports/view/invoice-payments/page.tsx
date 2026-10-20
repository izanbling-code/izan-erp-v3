"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Printer, Download, Loader2, ArrowLeft, Search } from "lucide-react";

export default function InvoicePaymentsReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        
        let query = supabase.from("Payment")
          .select(`*, customer:Customer(name), account:Account(name, code)`)
          .eq("companyId", company?.id)
          .eq("type", "RECEIPT"); // Only incoming payments

        if (startDate) query = query.gte("paymentDate", startDate);
        if (endDate) query = query.lte("paymentDate", endDate);

        const { data: txs } = await query.order("paymentDate", { ascending: true });
        setData(txs || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [startDate, endDate]);

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);
  
  const filteredRows = data.filter((r: any) => 
    r.paymentNo?.toLowerCase().includes(search.toLowerCase()) || 
    r.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.reference?.toLowerCase().includes(search.toLowerCase())
  );

  const exportToExcel = () => {
    let csvContent = "Date,Receipt #,Customer,Reference,Destination Account,Amount\n";
    filteredRows.forEach(r => {
      csvContent += `"${new Date(r.paymentDate).toISOString().slice(0, 10)}","${r.paymentNo}","${r.customer?.name || 'Guest'}","${r.reference || ''}","${r.account?.name}","${r.amount}"\n`;
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `invoice_payments.csv`; link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <style jsx global>{`@media print { body * { visibility: hidden; } #printable, #printable * { visibility: visible; } #printable { position: absolute; left: 0; top: 0; width: 100%; color: black !important; } .print-hide { display: none !important; } }`}</style>

      <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 print-hide">
        <div>
          <Link href="/reports" className="text-sm font-bold text-zinc-500 hover:text-white mb-2 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Back</Link>
          <h1 className="text-2xl font-bold text-white">Sales Invoice Payments</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Printer className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="bg-zinc-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end print-hide">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Search receipt # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark]" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark]" />
        </div>
      </div>

      <div id="printable" className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        {loading ? ( <div className="py-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div> ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-950/50 border-b border-white/5 text-[11px] uppercase text-zinc-500 font-bold print:bg-gray-100 print:text-black">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Destination Account</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 print:divide-gray-200">
              {filteredRows.map((row: any) => (
                <tr key={row.id} className="hover:bg-white/5">
                  <td className="py-3 px-4 text-sm text-zinc-400 print:text-black">{new Date(row.paymentDate).toISOString().slice(0, 10)}</td>
                  <td className="py-3 px-4 text-sm font-bold text-white print:text-black font-mono">{row.paymentNo}</td>
                  <td className="py-3 px-4 text-sm font-medium text-zinc-300 print:text-black">{row.customer?.name || "Guest"}</td>
                  <td className="py-3 px-4 text-sm text-zinc-500 font-mono print:text-black">{row.reference || "—"}</td>
                  <td className="py-3 px-4 text-sm text-indigo-400 print:text-black">{row.account?.name}</td>
                  <td className="py-3 px-4 text-sm font-mono text-right font-bold text-emerald-400 print:text-black">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}