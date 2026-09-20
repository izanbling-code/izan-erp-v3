"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

const REPORT_META: Record<string, { title: string; category: string; endpoint: string; description: string }> = {
  sales: {
    title: "Sales Summary & Margin Analysis",
    category: "Sales Reports",
    endpoint: "/api/reports/sales/customers",
    description: "Breakdown of sales invoices, customer revenue, and batch COGS.",
  },
  purchases: {
    title: "Purchase Bill Register",
    category: "Purchase Reports",
    endpoint: "/api/reports/purchases",
    description: "Register of vendor bills, settlement statuses, and payables.",
  },
  inventory: {
    title: "Stock & Batch Valuation",
    category: "Inventory & Valuations",
    endpoint: "/api/reports/inventory",
    description: "Warehouse stock valuation calculated from batch-specific acquisition costs.",
  },
  expenses: {
    title: "Operating Expense Breakdown",
    category: "Expense Reports",
    endpoint: "/api/reports/expenses",
    description: "Operating expenditures posted to general ledger expense heads.",
  },
  accounts: {
    title: "Chart of Accounts Ledger Summary",
    category: "Finance & Ledgers",
    endpoint: "/api/reports/accounts",
    description: "Debit, credit, and balance summary for all accounts.",
  },
  "general-ledger": {
    title: "General Ledger Statement",
    category: "Finance & Ledgers",
    endpoint: "/api/reports/general-ledger",
    description: "Chronological journal transactions with running balances for individual ledger accounts.",
  },
  "trial-balance": {
    title: "Trial Balance Statement",
    category: "Financial Statements",
    endpoint: "/api/reports/trial-balance",
    description: "Audit of debit and credit balances verifying fundamental accounting equality.",
  },
  "profit-loss": {
    title: "Statement of Profit & Loss (P&L)",
    category: "Financial Statements",
    endpoint: "/api/reports/profit-loss",
    description: "Revenues, cost of goods sold, overheads, and net margin.",
  },
  "balance-sheet": {
    title: "Balance Sheet Statement",
    category: "Financial Statements",
    endpoint: "/api/reports/balance-sheet",
    description: "Statement of financial condition detailing Assets, Liabilities, and Equity.",
  },
};

function money(value: any) {
  const n = Number(value ?? 0);
  return `Rs ${Number.isFinite(n) ? n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}`;
}

const HIDDEN_KEYS = new Set(["id", "accountId", "supplierId", "customerId", "warehouseId", "batchId"]);

export default function DedicatedReportPage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = use(params);
  const reportType = resolvedParams.type;
  const meta = REPORT_META[reportType] || {
    title: "Financial Statement",
    category: "Reports",
    endpoint: `/api/reports/${reportType}`,
    description: "Business Report",
  };

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");

  async function fetchReportData() {
    try {
      setLoading(true);
      setError("");

      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (selectedAccount) query.set("accountId", selectedAccount);

      const res = await fetch(`${meta.endpoint}?${query.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load statement data.");
      setData(json);
      if (json.selectedAccountId && !selectedAccount) {
        setSelectedAccount(json.selectedAccountId);
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to load statement data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReportData();
  }, [reportType, selectedAccount]);

  const rows = data?.rows || [];
  const customReport = data?.report;
  const summary = data?.summary;
  const accountList = data?.accounts || [];

  // Filter out internal database IDs from the display table
  const visibleKeys = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]).filter((k) => !HIDDEN_KEYS.has(k));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!search.trim() || !rows.length) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      visibleKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))
    );
  }, [rows, search, visibleKeys]);

  return (
    <ERPShell title={meta.title}>
      {/* Print isolation rules */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-statement, #printable-statement * {
            visibility: visible;
          }
          #printable-statement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
          }
          nav, aside, header, .print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Navigation & Actions */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 print-hide flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              <Link href="/reports" className="hover:text-purple-600 transition">Reports Hub</Link>
              <span>/</span>
              <span>{meta.category}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{meta.title}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <span>🖨️</span> Save as PDF / Print Statement
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 print-hide flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {reportType === "general-ledger" && accountList.length > 0 && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Select Ledger Account</span>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-purple-500 bg-white"
                >
                  {accountList.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                  ))}
                </select>
              </div>
            )}

            {reportType !== "balance-sheet" && (
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From Date</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-purple-500"
                />
              </div>
            )}
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">As Of / To Date</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={fetchReportData}
              className="mt-4 bg-gray-900 hover:bg-black text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              Update Statement
            </button>
          </div>

          {rows.length > 0 && (
            <div>
              <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Search in Table</span>
              <input
                type="text"
                placeholder="Filter table..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1 text-xs outline-none focus:border-purple-500 w-56"
              />
            </div>
          )}
        </div>

        {/* Statement Output Container */}
        <div id="printable-statement" className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 space-y-8">
          {/* Letterhead */}
          <div className="border-b pb-6 text-center space-y-1">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-wider">IZAN BLING</h2>
            <h3 className="text-sm font-extrabold text-purple-700 tracking-wide uppercase">{meta.title}</h3>
            <p className="text-xs text-gray-500">
              {from || to ? `Period: ${from || "Beginning"} to ${to || "Present"}` : "As of Current Date"} • Generated: {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}
            </p>
          </div>

          {/* Metric Summary Ribbon */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              {Object.entries(summary).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">{k}</div>
                  <div className="text-sm font-extrabold text-gray-900 mt-0.5">{String(v)}</div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>}

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-xs font-semibold">Generating formal accounting statement...</div>
          ) : (
            <>
              {/* 1. BALANCE SHEET */}
              {reportType === "balance-sheet" && customReport && (
                <div className="space-y-8 text-xs text-gray-800">
                  {/* ASSETS */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b-2 border-gray-900 pb-1 flex justify-between">
                      <span>Assets</span>
                      <span>Amount</span>
                    </h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.assets.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-gray-50/50">
                            <td className="py-2 px-2 text-gray-600 w-24 font-mono">{acc.code}</td>
                            <td className="py-2 px-2 font-medium">{acc.name}</td>
                            <td className="py-2 px-2 text-right font-mono">{money(acc.balance)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50/80 font-bold border-t-2 border-gray-300">
                          <td colSpan={2} className="py-2.5 px-2 uppercase text-gray-900">Total Assets</td>
                          <td className="py-2.5 px-2 text-right font-mono text-gray-900 underline decoration-double">{money(customReport.totalAssets)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* LIABILITIES */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b-2 border-gray-900 pb-1 flex justify-between">
                      <span>Liabilities</span>
                      <span>Amount</span>
                    </h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.liabilities.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-gray-50/50">
                            <td className="py-2 px-2 text-gray-600 w-24 font-mono">{acc.code}</td>
                            <td className="py-2 px-2 font-medium">{acc.name}</td>
                            <td className="py-2 px-2 text-right font-mono">{money(acc.balance)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50/80 font-bold border-t-2 border-gray-300">
                          <td colSpan={2} className="py-2.5 px-2 uppercase text-gray-900">Total Liabilities</td>
                          <td className="py-2.5 px-2 text-right font-mono text-gray-900">{money(customReport.totalLiabilities)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* EQUITY */}
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b-2 border-gray-900 pb-1 flex justify-between">
                      <span>Owner&#39;s Equity</span>
                      <span>Amount</span>
                    </h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.equity.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-gray-50/50">
                            <td className="py-2 px-2 text-gray-600 w-24 font-mono">{acc.code}</td>
                            <td className="py-2 px-2 font-medium">{acc.name}</td>
                            <td className="py-2 px-2 text-right font-mono">{money(acc.balance)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50/80 font-bold border-t-2 border-gray-300">
                          <td colSpan={2} className="py-2.5 px-2 uppercase text-gray-900">Total Equity</td>
                          <td className="py-2.5 px-2 text-right font-mono text-gray-900">{money(customReport.totalEquity)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* TOTAL LIABILITIES & EQUITY */}
                  <div className="p-3 bg-purple-50 border-2 border-purple-200 rounded-lg flex justify-between items-center font-extrabold text-xs">
                    <span className="uppercase text-purple-900">Total Liabilities & Equity</span>
                    <span className="text-purple-900 font-mono text-sm underline decoration-double">{money(customReport.totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>
              )}

              {/* 2. PROFIT & LOSS */}
              {reportType === "profit-loss" && customReport && (
                <div className="space-y-8 text-xs text-gray-800">
                  {/* REVENUE */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b pb-1">1. Operating Revenue</h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.revenues.map((r: any) => (
                          <tr key={r.code}>
                            <td className="py-2 text-gray-500 w-24 font-mono">{r.code}</td>
                            <td className="py-2 font-medium">{r.name}</td>
                            <td className="py-2 text-right font-mono">{money(r.amount)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold border-t bg-gray-50">
                          <td colSpan={2} className="py-2 px-2">Total Operating Revenue</td>
                          <td className="py-2 px-2 text-right font-mono">{money(customReport.totalRevenue)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* COGS */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b pb-1">2. Cost of Goods Sold (COGS)</h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.cogs.map((c: any) => (
                          <tr key={c.code}>
                            <td className="py-2 text-gray-500 w-24 font-mono">{c.code}</td>
                            <td className="py-2 font-medium">{c.name}</td>
                            <td className="py-2 text-right font-mono">{money(c.amount)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold border-t bg-gray-50">
                          <td colSpan={2} className="py-2 px-2">Total Cost of Goods Sold</td>
                          <td className="py-2 px-2 text-right font-mono text-red-600">({money(customReport.totalCogs)})</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* GROSS PROFIT */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex justify-between font-extrabold">
                    <span>GROSS PROFIT (Margin: {customReport.grossMargin})</span>
                    <span className="font-mono">{money(customReport.grossProfit)}</span>
                  </div>

                  {/* OPERATING EXPENSES */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-sm uppercase text-gray-900 border-b pb-1">3. Operating Expenses by Head</h4>
                    <table className="erp-data-table">
                      <tbody className="divide-y divide-gray-100">
                        {customReport.expenses.map((e: any) => (
                          <tr key={e.code}>
                            <td className="py-2 text-gray-500 w-24 font-mono">{e.code}</td>
                            <td className="py-2 font-medium">{e.name}</td>
                            <td className="py-2 text-right font-mono">{money(e.amount)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold border-t bg-gray-50">
                          <td colSpan={2} className="py-2 px-2">Total Operating Expenses</td>
                          <td className="py-2 px-2 text-right font-mono text-red-600">({money(customReport.totalExpenses)})</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* NET PROFIT */}
                  <div className="p-4 bg-purple-900 text-white rounded-lg flex justify-between items-center font-extrabold text-sm">
                    <span>NET PROFIT / (NET LOSS)</span>
                    <span className="font-mono text-lg">{money(customReport.netProfit)}</span>
                  </div>
                </div>
              )}

              {/* 3. TRIAL BALANCE & STANDARD REPORTS */}
              {reportType !== "balance-sheet" && reportType !== "profit-loss" && (
                <div className="overflow-x-auto">
                  <table className="erp-data-table">
                    <thead>
                      <tr className="border-b-2 border-gray-900 bg-gray-50 font-bold uppercase text-[10px]">
                        {reportType === "trial-balance" ? (
                          <>
                            <th className="py-3 px-3">Account Code</th>
                            <th className="py-3 px-3">Account Name</th>
                            <th className="py-3 px-3">Account Type</th>
                            <th className="py-3 px-3 text-right">Debit (PKR)</th>
                            <th className="py-3 px-3 text-right">Credit (PKR)</th>
                          </>
                        ) : (
                          visibleKeys.map((k) => (
                            <th key={k} className="py-3 px-3">{k.replace(/([A-Z])/g, " $1")}</th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRows.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/80">
                          {reportType === "trial-balance" ? (
                            <>
                              <td className="py-2 px-3 font-mono text-gray-500">{row.accountCode}</td>
                              <td className="py-2 px-3 font-medium text-gray-900">{row.accountName}</td>
                              <td className="py-2 px-3 text-gray-500 text-[11px]">{row.accountType}</td>
                              <td className="py-2 px-3 text-right font-mono text-gray-800">{row.debit > 0 ? money(row.debit) : "—"}</td>
                              <td className="py-2 px-3 text-right font-mono text-gray-800">{row.credit > 0 ? money(row.credit) : "—"}</td>
                            </>
                          ) : (
                            visibleKeys.map((k, vIdx) => (
                              <td key={vIdx} className="py-2 px-3 text-gray-700">
                                {typeof row[k] === "number" ? money(row[k]) : String(row[k] ?? "—")}
                              </td>
                            ))
                          )}
                        </tr>
                      ))}

                      {reportType === "trial-balance" && data?.totals && (
                        <tr className="font-extrabold bg-gray-50 border-t-2 border-gray-900">
                          <td colSpan={3} className="py-3 px-3 uppercase text-gray-900">Total Balanced Equality</td>
                          <td className="py-3 px-3 text-right font-mono text-gray-900 underline decoration-double">{money(data.totals.debit)}</td>
                          <td className="py-3 px-3 text-right font-mono text-gray-900 underline decoration-double">{money(data.totals.credit)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ERPShell>
  );
}
