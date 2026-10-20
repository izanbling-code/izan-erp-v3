"use client";

import Link from "next/link";
import { BookOpen, Search, FileText, BarChart3, TrendingUp, DollarSign, Warehouse, Scale, Landmark } from "lucide-react";

type ReportItem = { title: string; description: string; slug: string; icon: any; };
type ReportSection = { category: string; icon: any; description: string; reports: ReportItem[]; };

const SECTIONS: ReportSection[] = [
  {
    category: "Sales Reports", icon: <TrendingUp className="w-5 h-5 text-teal-400" />, description: "Revenue performance, customer order volumes, and gross profit margins.",
    reports: [ { title: "Sales Summary", description: "Customer-wise revenue, batch cost of goods sold, and gross margins.", slug: "sales", icon: <BarChart3 className="w-4 h-4" /> } ]
  },
  {
    category: "Purchase & Procurement", icon: <DollarSign className="w-5 h-5 text-emerald-400" />, description: "Vendor procurement, raw material bills, and supplier liabilities.",
    reports: [ { title: "Purchase Bill Register", description: "Supplier bills, billed subtotals, paid amounts, and balances due.", slug: "purchases", icon: <FileText className="w-4 h-4" /> } ]
  },
  {
    category: "Expense Reports", icon: <TrendingUp className="w-5 h-5 text-rose-400 rotate-180" />, description: "Detailed operating expenditures, marketing spend, and operational costs.",
    reports: [ { title: "Operating Expenses", description: "Posted operating expense transactions grouped by expense accounts.", slug: "expenses", icon: <FileText className="w-4 h-4" /> } ]
  },
  {
    category: "Finance & Ledgers", icon: <Landmark className="w-5 h-5 text-indigo-400" />, description: "General ledger audit trails, account balances, and real-time inventory valuation.",
    reports: [
      { title: "Stock Valuation", description: "Warehouse stock levels evaluated against specific batch unit costs.", slug: "inventory", icon: <Warehouse className="w-4 h-4" /> },
      { title: "General Ledger", description: "Chronological debit and credit transactions with running balances.", slug: "general-ledger", icon: <BookOpen className="w-4 h-4" /> },
      { title: "Chart of Accounts", description: "Complete list of active GL accounts with cumulative balances.", slug: "accounts", icon: <Scale className="w-4 h-4" /> },
      { title: "Cash Book", description: "Complete chronological ledger of physical cash flowing in and out.", slug: "cash-book", icon: <FileText className="w-4 h-4" /> },
      { title: "Cash Deposits", description: "Tracks all funds transferred into bank accounts.", slug: "cash-deposits", icon: <DollarSign className="w-4 h-4" /> },
      { title: "Bank Ledgers", description: "Printable statements and running balances for bank accounts.", slug: "bank-ledgers", icon: <Landmark className="w-4 h-4" /> },
      { title: "Invoice Payments", description: "Tracks amounts received against customer invoices.", slug: "invoice-payments", icon: <FileText className="w-4 h-4" /> }
    ]
  },
  {
    category: "Financial Statements", icon: <Scale className="w-5 h-5 text-amber-400" />, description: "Core financial statements for accounting verification.",
    reports: [
      { title: "Trial Balance", description: "Comprehensive debit vs. credit integrity verification.", slug: "trial-balance", icon: <Scale className="w-4 h-4" /> },
      { title: "Profit & Loss", description: "Operating revenues, cost of sales, and net profit.", slug: "profit-loss", icon: <TrendingUp className="w-4 h-4" /> },
      { title: "Balance Sheet", description: "Summary of assets, liabilities, and owner equity.", slug: "balance-sheet", icon: <FileText className="w-4 h-4" /> }
    ]
  }
];

export default function ReportsHubPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-500" /> Reports Suite
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Access dedicated business, commercial, and financial intelligence statements.</p>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <div key={section.category} className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <div className="bg-black/20 px-6 py-4 border-b border-white/5 flex items-center gap-4">
              <div className="p-2 bg-white/5 rounded-lg border border-white/10">{section.icon}</div>
              <div>
                <h2 className="text-base font-bold text-white">{section.category}</h2>
                <p className="text-xs text-zinc-400">{section.description}</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.reports.map((report) => (
                <Link key={report.slug} href={`/reports/view/${report.slug}`} className="group block p-4 rounded-xl border border-white/5 bg-zinc-950/50 hover:bg-white/5 hover:border-teal-500/30 transition-all duration-150">
                  <div className="flex items-start gap-4">
                    <span className="p-2.5 bg-zinc-900 text-zinc-400 group-hover:text-teal-400 rounded-lg transition-colors">{report.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors flex items-center justify-between">
                        <span className="truncate">{report.title}</span>
                        <span className="text-zinc-600 group-hover:text-teal-400 group-hover:translate-x-1 transition-transform ml-2">→</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{report.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}