"use client";

import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

type ReportItem = { title: string; description: string; slug: string; icon: string; };
type ReportSection = { category: string; icon: string; description: string; reports: ReportItem[]; };

const SECTIONS: ReportSection[] = [
  {
    category: "Sales Reports", icon: "🏷️", description: "Revenue performance, customer order volumes, and gross profit margins.",
    reports: [ { title: "Sales Summary & Margin Analysis", description: "Customer-wise revenue, batch cost of goods sold, and gross margins.", slug: "sales", icon: "▤" } ]
  },
  {
    category: "Purchase & Procurement", icon: "🛒", description: "Vendor procurement, raw material bills, and supplier liabilities.",
    reports: [ { title: "Purchase Bill Register", description: "Supplier bills, billed subtotals, paid amounts, and balances due.", slug: "purchases", icon: "▥" } ]
  },
  {
    category: "Expense Reports", icon: "💸", description: "Detailed operating expenditures, marketing spend, and operational costs.",
    reports: [ { title: "Operating Expense Breakdown", description: "Posted operating expense transactions grouped by expense accounts.", slug: "expenses", icon: "📉" } ]
  },
  {
    category: "Finance & Ledgers", icon: "🏦", description: "General ledger audit trails, account balances, and real-time inventory valuation.",
    reports: [
      { title: "Stock & Batch Valuation", description: "Warehouse stock levels evaluated against specific batch unit costs.", slug: "inventory", icon: "▦" },
      { title: "General Ledger Audit Trail", description: "Chronological debit and credit transactions with running account balances.", slug: "general-ledger", icon: "📖" },
      { title: "Chart of Accounts Balances", description: "Complete list of active GL accounts with cumulative debits, credits, and balances.", slug: "accounts", icon: "⚖" },
      { title: "Cash Book Register", description: "Complete chronological ledger of physical cash flowing in and out, with running balances.", slug: "cash-book", icon: "💵" },
      { title: "Cash Deposit Report", description: "Tracks all funds transferred into bank accounts and identifies their source account.", slug: "cash-deposits", icon: "💸" },
      { title: "Bank Ledgers", description: "Printable chronological statements and running balances for all registered bank accounts.", slug: "bank-ledgers", icon: "🏦" },
      { title: "Sales Invoice Payments", description: "Tracks total amounts received against customer invoices and identifies destination cash or bank accounts.", slug: "invoice-payments", icon: "🧾" }
    ]
  },
  {
    category: "Financial Reporting", icon: "📊", description: "Core financial statements for accounting verification and management review.",
    reports: [
      { title: "Trial Balance Statement", description: "Comprehensive debit vs. credit integrity verification across all accounts.", slug: "trial-balance", icon: "⚖" },
      { title: "Profit & Loss Statement (P&L)", description: "Operating revenues, cost of sales, operational overheads, and net profit.", slug: "profit-loss", icon: "📈" },
      { title: "Balance Sheet Statement", description: "Summary of assets, liabilities, and owner equity as of a selected date.", slug: "balance-sheet", icon: "🏛" }
    ]
  }
];

export default function ReportsHubPage() {
  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Reports Suite</h1>
          <p className="text-sm text-gray-500 mt-1">Access dedicated business, commercial, and financial intelligence statements. Select a report to configure filters and generate formatted views.</p>
        </div>
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                <span className="text-xl">{section.icon}</span>
                <div>
                  <h2 className="text-base font-bold text-gray-800">{section.category}</h2>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.reports.map((report) => (
                  <Link key={report.slug} href={`/reports/view/${report.slug}`} className="group block p-4 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50/30 transition-all duration-150">
                    <div className="flex items-start gap-3">
                      <span className="p-2 bg-gray-100 group-hover:bg-purple-100 group-hover:text-purple-700 text-gray-600 rounded-md text-sm transition">{report.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800 group-hover:text-purple-700 transition flex items-center justify-between"><span className="truncate">{report.title}</span><span className="text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-transform text-xs ml-1">→</span></div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{report.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ERPShell>
  );
}