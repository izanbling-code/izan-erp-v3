"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Printer, Download, Loader2, ArrowLeft, Search } from "lucide-react";

export default function BankLedgerReport() {
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
        
        // Fetch Bank Accounts
        const { data: banks } = await supabase.from("BankAccount").select("*").eq("companyId", company?.id);
        
        if (!banks) return setLoading(false);

        // Fetch Transactions for these banks
        let query = supabase.from("BankTransaction").select("*").in("bankAccountId", banks.map(b => b.id));
        if (startDate) query = query.gte("transactionDate", startDate);
        if (endDate) query = query.lte("transactionDate", endDate);
        
        const { data: txs } = await query.order("transactionDate", { ascending: true });

        // Group transactions by bank and calculate running balance
        const ledgerData = banks.map(bank => {
          const bankTxs = (txs || []).filter(t => t.bankAccountId === bank.id);
          let balance = 0;
          
          const processedTxs = bankTxs.map(tx => {
            const inAmt = Number(tx.moneyIn) || 0;
            const outAmt = Number(tx.moneyOut) || 0;
            balance += (inAmt - outAmt);
            return { ...tx, runningBalance: balance };
          });

          return { ...bank, transactions: processedTxs };
        });

        setData(ledgerData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [startDate, endDate]);

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);

  const exportToExcel = () => {
    let csvContent = "Bank Name,Account Title,Date,Reference,Description,In (Dr),Out (Cr),Balance\n";
    data.forEach(bank => {
      bank.transactions.forEach((tx: any) => {
        csvContent += `"${bank.bankName}","${bank.accountTitle}","${new Date(tx.transactionDate).toISOString().slice(0, 10)}","${tx.reference || ''}","${tx.description}","${tx.moneyIn}","${tx.moneyOut}","${tx.runningBalance}"\n`;
      });
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank_ledgers.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <style jsx global>{`@media print { body * { visibility: hidden; } #printable, #printable * { visibility: visible; } #printable { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; } .print-hide { display: none !important; } }`}</style>
      
      {/* Header */}
      <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 print-hide">
        <div>
          <Link href="/reports" className="text-sm font-bold text-zinc-500 hover:text-white mb-2 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4"/> Back to Reports</Link>
          <h1 className="text-2xl font-bold text-white">Bank Ledgers</h1>
          <p className="text-sm text-zinc-400 mt-1">Chronological statements and running balances for all bank accounts.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Excel</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-sm font-semibold flex items-center gap-2"><Printer className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end print-hide">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Search description..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
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

      {/* Content */}
      <div id="printable" className="space-y-8">
        {loading ? ( 
          <div className="py-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div> 
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">No bank accounts registered.</div>
        ) : data.map((bank: any) => {
          const filteredTxs = bank.transactions.filter((t: any) => 
            t.description?.toLowerCase().includes(search.toLowerCase()) || 
            t.reference?.toLowerCase().includes(search.toLowerCase())
          );

          return (
            <div key={bank.id} className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
              <div className="bg-black/40 p-4 border-b border-white/5 flex justify-between items-center print:bg-gray-100 print:text-black">
                <div>
                  <h4 className="font-bold text-white text-lg print:text-black">{bank.bankName}</h4>
                  <p className="text-xs text-zinc-400 print:text-gray-600">{bank.accountTitle} • {bank.accountNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-500 uppercase font-bold tracking-widest print:text-gray-600">Current Balance</span>
                  <div className="text-lg font-mono font-bold text-teal-400 print:text-black">
                    {formatCurrency(filteredTxs.length > 0 ? filteredTxs[filteredTxs.length - 1].runningBalance : 0)}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/50 text-[11px] uppercase text-zinc-500 font-bold tracking-wider print:bg-gray-100 print:text-black">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-right text-emerald-400 print:text-black">In (Dr)</th>
                      <th className="py-3 px-4 text-right text-rose-400 print:text-black">Out (Cr)</th>
                      <th className="py-3 px-4 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 print:divide-gray-200">
                    {filteredTxs.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-white/5 print:hover:bg-transparent">
                        <td className="py-3 px-4 text-sm text-zinc-400 print:text-black">{new Date(tx.transactionDate).toISOString().slice(0, 10)}</td>
                        <td className="py-3 px-4 text-sm font-bold text-white print:text-black">{tx.reference || "—"}</td>
                        <td className="py-3 px-4 text-sm text-zinc-300 print:text-black">{tx.description}</td>
                        <td className="py-3 px-4 text-sm font-mono text-right text-emerald-400 print:text-black">{tx.moneyIn > 0 ? formatCurrency(tx.moneyIn) : "—"}</td>
                        <td className="py-3 px-4 text-sm font-mono text-right text-rose-400 print:text-black">{tx.moneyOut > 0 ? formatCurrency(tx.moneyOut) : "—"}</td>
                        <td className="py-3 px-4 text-sm font-mono text-right font-bold text-white print:text-black">{formatCurrency(tx.runningBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}