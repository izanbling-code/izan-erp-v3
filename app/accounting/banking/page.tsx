"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

type BankAccount = {
  id: string; bankName: string; accountTitle: string; accountNumber: string;
  iban: string | null; branchCode: string | null; currency: string; isActive: boolean;
  openingBalance: number; clearedBalance: number; pendingBalance: number; totalBookBalance: number;
};

export default function BankDirectoryPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ bankName: "", accountTitle: "", accountNumber: "", iban: "", branchCode: "", openingBalance: "" });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ bankName: "", accountTitle: "", accountNumber: "", iban: "", branchCode: "", isActive: true, openingBalance: "" });

  const [submitting, setSubmitting] = useState(false);

  async function loadDirectory() {
    try {
      setLoading(true);
      const res = await fetch(`/api/banking/accounts?includeInactive=${includeInactive}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setAccounts(json.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDirectory(); }, [includeInactive]);

  async function handleAddBank(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/banking/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addForm) });
      setShowAddModal(false);
      setAddForm({ bankName: "", accountTitle: "", accountNumber: "", iban: "", branchCode: "", openingBalance: "" });
      loadDirectory();
    } finally { setSubmitting(false); }
  }

  function openEditModal(acc: BankAccount) {
    setEditingId(acc.id);
    setEditForm({
      bankName: acc.bankName, accountTitle: acc.accountTitle, accountNumber: acc.accountNumber,
      iban: acc.iban || "", branchCode: acc.branchCode || "", isActive: acc.isActive, openingBalance: String(acc.openingBalance)
    });
    setShowEditModal(true);
  }

  async function handleEditBank(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/banking/accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...editForm }) });
      setShowEditModal(false);
      setEditingId(null);
      loadDirectory();
    } finally { setSubmitting(false); }
  }

  async function handleDeleteBank(acc: BankAccount) {
    if (!confirm(`Are you sure you want to delete ${acc.bankName}?`)) return;
    try {
      const res = await fetch(`/api/banking/accounts?id=${acc.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) alert(json.error);
      loadDirectory();
    } catch (err) { alert("Delete failed"); }
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(amt);
  const totalLiquidity = accounts.filter(a => a.isActive).reduce((sum, acc) => sum + acc.totalBookBalance, 0);

  return (
    <ERPShell>
      <div className="max-w-6xl mx-auto p-6 space-y-5 text-sm">
        
        {/* Sleek Header & Minimal Summary Widget */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Banking Directory</h1>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="text-gray-500 text-xs">Total Active Liquidity:</span>
              <span className="text-lg font-bold text-emerald-700 tracking-tight">{formatCurrency(totalLiquidity)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 font-medium cursor-pointer">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-gray-300" />
              Show Inactive
            </label>
            <button onClick={() => setShowAddModal(true)} className="bg-gray-900 hover:bg-black text-white font-bold py-2 px-4 rounded-lg transition shadow-sm text-xs">
              + Add Bank Account
            </button>
          </div>
        </div>

        {/* ENTERPRISE COMPACT LIST VIEW */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="erp-data-table">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                <th className="py-3 px-4">Bank Details</th>
                <th className="py-3 px-4">Account Info</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Live Ledger Balance</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[13px]">
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400 font-medium">Loading directory...</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No bank accounts registered.</td></tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className={`hover:bg-gray-50/50 transition ${!acc.isActive ? "opacity-60 bg-gray-50" : ""}>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{acc.bankName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{acc.accountTitle}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-gray-800 font-medium">{acc.accountNumber}</div>
                      {acc.iban && <div className="font-mono text-[10px] text-gray-500 mt-0.5">IBAN: {acc.iban}</div>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {acc.isActive ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">ACTIVE</span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider">INACTIVE</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900 text-sm">
                      {formatCurrency(acc.totalBookBalance)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/accounting/banking/${acc.id}`} className="bg-white border border-gray-200 hover:border-gray-300 text-gray-800 font-semibold py-1.5 px-3 rounded-lg text-xs transition shadow-sm">
                          Manage
                        </Link>
                        <button onClick={() => openEditModal(acc)} className="p-1.5 text-gray-400 hover:text-blue-600 transition">✏️</button>
                        <button onClick={() => handleDeleteBank(acc)} className="p-1.5 text-gray-400 hover:text-rose-600 transition">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPACT MODALS (Add/Edit logic remains mostly the same, just included opening balance in edit) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-sm font-bold">Edit Bank Account</h2>
              <button onClick={() => setShowEditModal(false)} className="text-white/70 hover:text-white text-xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleEditBank} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Bank Name</span>
                  <input required value={editForm.bankName} onChange={(e) => setEditForm({...editForm, bankName: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Account Title</span>
                  <input required value={editForm.accountTitle} onChange={(e) => setEditForm({...editForm, accountTitle: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Account Number</span>
                  <input required value={editForm.accountNumber} onChange={(e) => setEditForm({...editForm, accountNumber: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-700">IBAN</span>
                  <input value={editForm.iban} onChange={(e) => setEditForm({...editForm, iban: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-700">Branch Code</span>
                  <input value={editForm.branchCode} onChange={(e) => setEditForm({...editForm, branchCode: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                
                {/* NEW: Safe Opening Balance Editor */}
                <label className="flex flex-col gap-1 col-span-2 pt-2 border-t mt-1">
                  <span className="font-semibold text-gray-700">Opening Balance (PKR)</span>
                  <input type="number" min="0" step="0.01" value={editForm.openingBalance} onChange={(e) => setEditForm({...editForm, openingBalance: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-bold" />
                  <span className="text-[10px] text-gray-400">Updating this safely alters Subledger & GL records automatically.</span>
                </label>

                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})} className="rounded border-gray-300" />
                    <span className="font-semibold text-gray-700">Account is Active</span>
                  </label>
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t mt-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-3 py-1.5 border rounded font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-1.5 rounded font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* ADD MODAL - Minimal version */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-sm font-bold">Register Bank</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white text-xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={handleAddBank} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Bank Name *</span>
                  <input required value={addForm.bankName} onChange={(e) => setAddForm({...addForm, bankName: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Account Title *</span>
                  <input required value={addForm.accountTitle} onChange={(e) => setAddForm({...addForm, accountTitle: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900" />
                </label>
                <label className="flex flex-col gap-1 col-span-2">
                  <span className="font-semibold text-gray-700">Account Number *</span>
                  <input required value={addForm.accountNumber} onChange={(e) => setAddForm({...addForm, accountNumber: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-700">IBAN</span>
                  <input value={addForm.iban} onChange={(e) => setAddForm({...addForm, iban: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-700">Branch Code</span>
                  <input value={addForm.branchCode} onChange={(e) => setAddForm({...addForm, branchCode: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-mono" />
                </label>
                <label className="flex flex-col gap-1 col-span-2 pt-2 border-t mt-1">
                  <span className="font-semibold text-gray-700">Opening Balance (PKR)</span>
                  <input type="number" min="0" step="0.01" value={addForm.openingBalance} onChange={(e) => setAddForm({...addForm, openingBalance: e.target.value})} className="border rounded p-2 bg-gray-50 outline-none focus:border-gray-900 font-bold" />
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t mt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border rounded font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-1.5 rounded font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">Register Bank</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </ERPShell>
  );
}