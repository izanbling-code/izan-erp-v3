"use client";

import { useEffect, useState, FormEvent } from "react";
import ERPShell from "@/app/components/erp-shell";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type CashRow = {
  id: string;
  date: string;
  reference: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  balance: number;
};

type VoucherType = "CRV" | "CPV" | "CTV";

export default function CashBookPage() {
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [rows, setRows] = useState<CashRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Voucher Modal State
  const [showModal, setShowModal] = useState(false);
  const [voucherType, setVoucherType] = useState<VoucherType>("CRV");
  const [submitting, setSubmitting] = useState(false);
  const [vForm, setVForm] = useState({
    offsetAccountId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    reference: "",
    description: ""
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      
      // Load All Accounts for the Offset Dropdown
      const accRes = await fetch("/api/accounts", { cache: "no-store" });
      const accJson = await accRes.json();
      if (accJson.ok) {
        setAllAccounts(accJson.accounts.filter((a: any) => a.isActive));
      }

      // Load Cash Book Ledger
      const query = new URLSearchParams();
      if (selectedAccountId) query.append("accountId", selectedAccountId);
      if (fromDate) query.append("from", fromDate);
      if (toDate) query.append("to", toDate);

      const res = await fetch(`/api/banking/cashbook?${query.toString()}`, { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load Cash Book");
      
            // STRICT CASH BOOK ARCHITECTURE: Block digital banks from Cash Book
      const strictCashAccounts = (json.accounts || []).filter((acc: any) => {
        const name = acc.name.toLowerCase();
        return name.includes("cash") && !name.includes("bank") && !name.includes("easypaisa") && !name.includes("meezan");
      });
      setCashAccounts(strictCashAccounts);
      
      if (!selectedAccountId && strictCashAccounts.length > 0) {
        setSelectedAccountId(strictCashAccounts[0].id);
      } else if (json.selectedAccountId && strictCashAccounts.some((a: any) => a.id === json.selectedAccountId)) {
        setSelectedAccountId(json.selectedAccountId);
      }
      setRows(json.rows || []);
      setOpeningBalance(json.openingBalance || 0);
      setClosingBalance(json.closingBalance || 0);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Cash Book");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId, fromDate, toDate]); // Auto-reload when filters change

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 2 }).format(amount);
  };

  const totalIn = rows.reduce((sum, row) => sum + row.moneyIn, 0);
  const totalOut = rows.reduce((sum, row) => sum + row.moneyOut, 0);

  function openVoucherModal(type: VoucherType) {
    if (!selectedAccountId) {
      alert("Please select a Cash/Bank account first.");
      return;
    }
    setVoucherType(type);
    setVForm({
      offsetAccountId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      reference: "",
      description: ""
    });
    setShowModal(true);
  }

  async function handleVoucherSubmit(e: FormEvent) {
    e.preventDefault();
    if (!vForm.offsetAccountId) return alert("Please select an offsetting account.");
    
    try {
      setSubmitting(true);
      const payload = {
        type: voucherType,
        cashAccountId: selectedAccountId,
        offsetAccountId: vForm.offsetAccountId,
        amount: Number(vForm.amount),
        date: vForm.date,
        reference: vForm.reference,
        description: vForm.description
      };

      const res = await fetch("/api/banking/cashbook/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to post voucher.");

      setShowModal(false);
      loadData(); // Instantly refresh ledger
    } catch (err) {
      alert(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  const offsetLabel = voucherType === "CRV" ? "Receive From (Customer / Revenue)" : voucherType === "CPV" ? "Pay To (Vendor / Expense)" : "Transfer Account (Bank / Cash)";
  const modalTitle = voucherType === "CRV" ? "Cash Receipt Voucher (CRV)" : voucherType === "CPV" ? "Cash Payment Voucher (CPV)" : "Contra Transfer Voucher (CTV)";

  return (
    <ERPShell title="Cash Book & Banking">
      <div className="max-w-6xl mx-auto p-6 space-y-6 text-sm">
        
        {/* Header & Actions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cash Book & Banking Ledger</h1>
            <p className="text-gray-500 mt-1">Manage operational cash flows and generate standard vouchers.</p>
          </div>
          
          <div className="flex gap-2">
            <button data-shortcut="r" onClick={() => openVoucherModal("CRV")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition text-xs shadow-sm">
              + Receive Cash
            </button>
            <button data-shortcut="p" onClick={() => openVoucherModal("CPV")} className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg transition text-xs shadow-sm">
              - Pay Cash
            </button>
            <button data-shortcut="t" onClick={() => openVoucherModal("CTV")} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition text-xs shadow-sm">
              â‡„ Transfer
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Active Book</span>
            <select 
              value={selectedAccountId} 
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="border border-gray-300 rounded-lg p-2.5 bg-white shadow-sm outline-none focus:border-gray-900 font-medium"
            >
              {cashAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider">From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg p-2.5 bg-white shadow-sm outline-none focus:border-gray-900" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider">To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-gray-300 rounded-lg p-2.5 bg-white shadow-sm outline-none focus:border-gray-900" />
          </label>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg font-medium">{error}</div>}

        {/* Financial Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="text-gray-500 font-semibold text-xs uppercase tracking-wider mb-1">Opening Balance</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(openingBalance)}</div>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl shadow-sm border border-emerald-100">
            <div className="text-emerald-700 font-semibold text-xs uppercase tracking-wider mb-1">Total Money In</div>
            <div className="text-2xl font-bold text-emerald-900">{formatCurrency(totalIn)}</div>
          </div>
          <div className="bg-rose-50 p-5 rounded-xl shadow-sm border border-rose-100">
            <div className="text-rose-700 font-semibold text-xs uppercase tracking-wider mb-1">Total Money Out</div>
            <div className="text-2xl font-bold text-rose-900">{formatCurrency(totalOut)}</div>
          </div>
          <div className="bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-800">
            <div className="text-gray-400 font-semibold text-xs uppercase tracking-wider mb-1">Active Closing Balance</div>
            <div className="text-2xl font-bold text-white">{formatCurrency(closingBalance)}</div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="erp-data-table">
            <thead>
              <tr className="border-b bg-gray-50 text-[11px] uppercase text-gray-500 font-bold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher / Ref</th>
                <th className="py-3 px-4 w-1/3">Description</th>
                <th className="py-3 px-4 text-right text-emerald-700">Money In (Dr)</th>
                <th className="py-3 px-4 text-right text-rose-700">Money Out (Cr)</th>
                <th className="py-3 px-4 text-right text-gray-900">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-[13px]">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400 font-semibold">Loading ledger...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">No transactions found for this period.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4 text-gray-600">{row.date}</td>
                    <td className="py-3 px-4 text-gray-900 font-bold tracking-tight">{row.reference}</td>
                    <td className="py-3 px-4 text-gray-700">{row.description}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{row.moneyIn > 0 ? formatCurrency(row.moneyIn) : "â€”"}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">{row.moneyOut > 0 ? formatCurrency(row.moneyOut) : "â€”"}</td>
                    <td className="py-3 px-4 text-right text-gray-900 font-bold">{formatCurrency(row.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VOUCHER ENTRY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className={`p-5 text-white ${voucherType === "CRV" ? "bg-emerald-600" : voucherType === "CPV" ? "bg-rose-600" : "bg-indigo-600"} flex justify-between items-center`}>
              <div>
                <h2 className="text-lg font-bold">{modalTitle}</h2>
                <p className="text-white/80 text-xs mt-0.5">Post an active transaction to the general ledger.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleVoucherSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold text-gray-700 text-xs">Date *</span>
                  <input required type="date" value={vForm.date} onChange={(e) => setVForm({...vForm, date: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none focus:border-gray-900 text-sm" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold text-gray-700 text-xs">Amount (PKR) *</span>
                  <input required type="number" min="0.01" step="0.01" placeholder="0.00" value={vForm.amount} onChange={(e) => setVForm({...vForm, amount: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none focus:border-gray-900 text-sm font-bold" />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700 text-xs">{offsetLabel} *</span>
                <select required value={vForm.offsetAccountId} onChange={(e) => setVForm({...vForm, offsetAccountId: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none focus:border-gray-900 text-sm">
                  <option value="">-- Select Account --</option>
                  {allAccounts.map(acc => (
                    <option key={acc.id} value={acc.id} disabled={acc.id === selectedAccountId}>
                      {acc.code} - {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700 text-xs">Invoice / Reference #</span>
                <input type="text" placeholder="e.g. INV-2026-001" value={vForm.reference} onChange={(e) => setVForm({...vForm, reference: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none focus:border-gray-900 text-sm" />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-semibold text-gray-700 text-xs">Description *</span>
                <textarea required rows={2} placeholder="Reason for transaction..." value={vForm.description} onChange={(e) => setVForm({...vForm, description: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none focus:border-gray-900 text-sm resize-none" />
              </label>

              <div className="pt-4 flex justify-end gap-3 border-t mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600 hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className={`px-5 py-2 rounded-lg font-bold text-white text-sm ${voucherType === "CRV" ? "bg-emerald-600 hover:bg-emerald-700" : voucherType === "CPV" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"} disabled:opacity-50`}>
                  {submitting ? "Posting..." : "Post Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ERPShell>
  );
}