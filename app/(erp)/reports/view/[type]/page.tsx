"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Printer, Download, Search, Loader2, ArrowLeft } from "lucide-react";

const REPORT_META: Record<string, { title: string; category: string; description: string }> = {
  sales: { title: "Sales Summary & Margin Analysis", category: "Sales Reports", description: "Breakdown of sales invoices, customer revenue, and batch COGS." },
  purchases: { title: "Purchase Bill Register", category: "Purchase Reports", description: "Register of vendor bills, settlement statuses, and payables." },
  inventory: { title: "Stock & Batch Valuation", category: "Inventory & Valuations", description: "Warehouse stock valuation calculated from batch-specific acquisition costs." },
  expenses: { title: "Operating Expense Breakdown", category: "Expense Reports", description: "Operating expenditures posted to general ledger expense heads." },
  accounts: { title: "Chart of Accounts Ledger Summary", category: "Finance & Ledgers", description: "Debit, credit, and balance summary for all accounts." },
  "general-ledger": { title: "General Ledger Statement", category: "Finance & Ledgers", description: "Chronological journal transactions with running balances for individual ledger accounts." },
  "trial-balance": { title: "Trial Balance Statement", category: "Financial Statements", description: "Audit of debit and credit balances verifying fundamental accounting equality." },
  "profit-loss": { title: "Statement of Profit & Loss (P&L)", category: "Financial Statements", description: "Revenues, cost of goods sold, overheads, and net margin." },
  "balance-sheet": { title: "Balance Sheet Statement", category: "Financial Statements", description: "Statement of financial condition detailing Assets, Liabilities, and Equity." },
};

// ✅ THE FIX: Strict Date Formatter to prevent Hydration Mismatch
function formatDate(dateString: string | Date) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`; // Forces DD/MM/YYYY on both server and client
}

function money(value: any) {
  const n = Number(value ?? 0);
  return `Rs ${Number.isFinite(n) ? n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

export default function DedicatedReportPage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = use(params);
  const reportType = resolvedParams.type;
  const meta = REPORT_META[reportType] || { title: "Financial Statement", category: "Reports", description: "Business Report" };

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        if (!company) throw new Error("Company not found");

        const { data: accData } = await supabase.from("Account").select("id, code, name, type").eq("companyId", company.id).order("code");
        const accountList = accData || [];
        if (accData) setAccounts(accData);

        let jeQuery = supabase.from("JournalEntry")
          .select(`*, lines:JournalLine(*)`) 
          .eq("companyId", company.id)
          .eq("status", "POSTED");

        if (from) jeQuery = jeQuery.gte("entryDate", from);
        if (to) jeQuery = jeQuery.lte("entryDate", to);
        
        const { data: jeData, error: jeError } = await jeQuery.order("entryDate", { ascending: true });
        if (jeError) throw jeError;

        let allLines: any[] = [];
        (jeData || []).forEach(je => {
          je.lines.forEach((line: any) => {
            const account = accountList.find((a: any) => a.id === line.accountId);
            allLines.push({
              ...line,
              entryDate: je.entryDate,
              reference: je.reference || je.entryNo,
              description: line.description || je.description,
              accountCode: account?.code,
              accountName: account?.name,
              accountType: account?.type
            });
          });
        });

        if (selectedAccount) {
          allLines = allLines.filter(l => l.accountId === selectedAccount);
        }

        allLines.sort((a, b) => {
          const dateDiff = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (a.reference || "").localeCompare(b.reference || "");
        });

        let runningBalance = 0;
        const processedLines = allLines.map(l => {
          const debit = Number(l.debit) || 0;
          const credit = Number(l.credit) || 0;
          const isDebitNormal = l.accountType === "ASSET" || l.accountType === "EXPENSE";
          const movement = isDebitNormal ? (debit - credit) : (credit - debit);
          runningBalance += movement;
          return { ...l, runningBalance };
        });

        setData({ rows: processedLines, rawEntries: jeData });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [reportType, selectedAccount, from, to]);

  const rows = data?.rows || [];

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      String(r.reference || "").toLowerCase().includes(q) ||
      String(r.description || "").toLowerCase().includes(q) ||
      String(r.accountName || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const exportToExcel = () => {
    if (!filteredRows.length) return;
    const headers = ["Date", "Reference", "Account Code", "Account Name", "Description", "Debit", "Credit", "Balance"];
    const csvRows = filteredRows.map((r: any) => [
      new Date(r.entryDate).toISOString().slice(0, 10),
      r.reference || "",
      r.accountCode || "",
      r.accountName || "",
      `"${(r.description || "").replace(/"/g, '""')}"`,
      Number(r.debit) || 0,
      Number(r.credit) || 0,
      Number(r.runningBalance) || 0
    ]);

    const csvContent = [headers.join(","), ...csvRows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}_report.csv`;
    link.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable-statement, #printable-statement * { visibility: visible; }
          #printable-statement { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px !important; border: none !important; box-shadow: none !important; color: black !important; background: white !important; }
          .print-hide { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 print-hide">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">
            <Link href="/reports" className="hover:text-teal-400 transition-colors flex items-center gap-1"><ArrowLeft className="w-3 h-3"/> Reports Hub</Link>
            <span>/</span><span>{meta.category}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{meta.description}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-semibold transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-teal-500/20 flex items-center gap-2">
            <Printer className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-wrap gap-4 items-end print-hide">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Search Transactions</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Search reference, description..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
          </div>
        </div>
        {["general-ledger", "accounts", "trial-balance", "profit-loss", "balance-sheet"].includes(reportType) && (
          <div className="min-w-[200px]">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Filter by Account</label>
            <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500">
              <option value="">All Accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">From Date</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">To Date</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500 [color-scheme:dark]" />
        </div>
      </div>

      {/* Statement Output */}
      <div id="printable-statement" className="bg-zinc-900/60 backdrop-blur-xl p-8 rounded-2xl border border-white/5 space-y-6">
        <div className="border-b border-white/10 pb-6 text-center">
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">IZAN BLING</h2>
          <h3 className="text-sm font-extrabold text-teal-400 tracking-wide uppercase mt-1">{meta.title}</h3>
          <p className="text-xs text-zinc-500 mt-2">
            {/* ✅ FIXED: Using the strict formatDate function to prevent hydration errors */}
            Period: {from ? formatDate(from) : "Beginning"} to {to ? formatDate(to) : "Present"} • Generated: {formatDate(new Date())}
          </p>
        </div>

        {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">{error}</div>}

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center text-teal-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <span className="text-sm font-bold tracking-widest uppercase">Generating Statement...</span>
          </div>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-950/50 font-bold uppercase text-[10px] text-zinc-500 tracking-wider print:bg-gray-100 print:text-black">
                  <th className="py-3 px-4 rounded-tl-lg">Date</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (Dr)</th>
                  <th className="py-3 px-4 text-right">Credit (Cr)</th>
                  <th className="py-3 px-4 text-right rounded-tr-lg">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 print:divide-gray-200">
                {filteredRows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors print:hover:bg-transparent">
                    <td className="py-3 px-4 text-sm text-zinc-400 font-mono print:text-black">{new Date(row.entryDate).toISOString().slice(0, 10)}</td>
                    <td className="py-3 px-4 text-sm font-medium text-white print:text-black">{row.reference || "—"}</td>
                    <td className="py-3 px-4 text-sm text-zinc-400 print:text-black">{row.accountCode} - {row.accountName}</td>
                    <td className="py-3 px-4 text-sm text-zinc-500 print:text-black">{row.description || "—"}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right text-white print:text-black">{row.debit > 0 ? money(row.debit) : "—"}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right text-white print:text-black">{row.credit > 0 ? money(row.credit) : "—"}</td>
                    <td className="py-3 px-4 text-sm font-mono text-right font-bold text-teal-400 print:text-black">{money(row.runningBalance)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">No transactions found for this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}