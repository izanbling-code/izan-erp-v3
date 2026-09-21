"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

type BankTransaction = { id: string; transactionDate: string; reference: string; description: string; instrumentType: string; moneyIn: number; moneyOut: number; status: string; };

export default function BankControlPanel() {
  const params = useParams();
  const id = params.id as string;

  const [bank, setBank] = useState<any>(null);
  const [allBanks, setAllBanks] = useState<any[]>([]);
  const [depositAccounts, setDepositAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [balances, setBalances] = useState({ cleared: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const [showClearModal, setShowClearModal] = useState(false);
  const [selectedToClear, setSelectedToClear] = useState<string[]>([]);
  const [clearing, setClearing] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [tForm, setTForm] = useState({ destBankId: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });

  const [showDeposit, setShowDeposit] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [dForm, setDForm] = useState({ creditAccountId: "", amount: "", date: new Date().toISOString().split("T")[0], description: "" });

  async function loadData() {
    try {
      setLoading(true);
      const [res, allRes, accRes] = await Promise.all([
        fetch(`/api/banking/accounts/${id}`, { cache: "no-store" }),
        fetch(`/api/banking/accounts`, { cache: "no-store" }),
        fetch(`/api/banking/deposit-accounts`, { cache: "no-store" })
      ]);
      const json = await res.json();
      const allJson = await allRes.json();
      const accJson = await accRes.json();
      
      if (json.ok) { setBank(json.bankAccount); setTransactions(json.transactions); setBalances({ cleared: json.clearedBalance, pending: json.pendingBalance, total: json.totalBookBalance }); }
      if (allJson.ok) setAllBanks(allJson.accounts);
      if (accJson.ok) setDepositAccounts(accJson.accounts);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, [id]);

  async function handleBulkClear() {
    if (selectedToClear.length === 0) return;
    setClearing(true);
    try {
      await fetch("/api/banking/transactions/bulk-clear", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selectedToClear }) });
      setShowClearModal(false); setSelectedToClear([]); loadData();
    } catch (err) { alert("Failed to clear payments"); } finally { setClearing(false); }
  }

  async function handleTransfer(e: FormEvent) {
    e.preventDefault(); setTransferring(true);
    try {
      const res = await fetch("/api/banking/transactions/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tForm, sourceBankId: id }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setShowTransfer(false); loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Transfer Failed"); } finally { setTransferring(false); }
  }

  async function handleDeposit(e: FormEvent) {
    e.preventDefault(); setDepositing(true);
    try {
      const res = await fetch("/api/banking/transactions/deposit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dForm, bankAccountId: id }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setShowDeposit(false); loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Deposit Failed"); } finally { setDepositing(false); }
  }

  async function handleDeleteTx(txId: string) {
    if (!confirm("Are you sure you want to completely delete this transaction? This will automatically VOID any linked Journal Entry.")) return;
    try {
      const res = await fetch(`/api/banking/transactions/${txId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Deletion Failed"); }
  }

  async function handleReverseTx(txId: string) {
    if (!confirm("Are you sure you want to reverse this transaction? This creates an offsetting entry here and fully reverses the debits/credits on the General Ledger.")) return;
    try {
      const res = await fetch(`/api/banking/transactions/${txId}/reverse`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Reversal Failed"); }
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);

  if (loading) return <ERPShell title="Bank Panel"><div className="p-10 text-center text-gray-500">Loading Control Panel...</div></ERPShell>;
  if (!bank) return <ERPShell title="Bank Panel"><div className="p-10 text-center text-red-500">Bank Account Not Found</div></ERPShell>;

  const pendingTxs = transactions.filter(t => t.status === "PENDING");

  return (
    <ERPShell title={`${bank.bankName} Control Panel`}>
      <div className="max-w-6xl mx-auto p-6 space-y-6 text-sm">
        <div className="bg-gray-900 p-6 rounded-xl shadow-sm text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1"><Link href="/accounting/banking" className="text-gray-400 hover:text-white transition">&larr; Back to Directory</Link></div>
            <h1 className="text-2xl font-bold">{bank.bankName} - {bank.accountTitle}</h1>
            <p className="text-gray-400 font-mono text-xs mt-1">A/C: {bank.accountNumber} {bank.iban ? `| IBAN: ${bank.iban}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowClearModal(true)} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold py-2 px-4 rounded-lg transition shadow-sm">✓ Clear Payments</button>
            <button onClick={() => setShowDeposit(true)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold py-2 px-4 rounded-lg transition shadow-sm">➕ Quick Deposit</button>
            <Link href={`/accounting/banking/${id}/reconcile`} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold py-2 px-4 rounded-lg transition shadow-sm">⚡ Reconcile CSV</Link>
            <button onClick={() => setShowTransfer(true)} className="bg-white text-gray-900 hover:bg-gray-100 font-bold py-2 px-4 rounded-lg transition shadow-sm">⇄ Transfer Funds</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider mb-1">Cleared Balance (Available)</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(balances.cleared)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="text-amber-500 font-bold text-xs uppercase tracking-wider mb-1">Uncleared / Pending</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(balances.pending)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <div className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">Total Subledger Balance</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(balances.total)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="erp-data-table">
            <thead>
              <tr className="border-b text-[11px] uppercase text-gray-500 font-bold bg-gray-50">
                <th className="py-3 px-4">Date</th><th className="py-3 px-4">Reference</th><th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-right text-emerald-700">In (Dr)</th><th className="py-3 px-4 text-right text-rose-700">Out (Cr)</th><th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-[13px]">
              {transactions.length === 0 ? ( <tr><td colSpan={7} className="py-12 text-center text-gray-400">No transactions recorded.</td></tr> ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition">
                    <td className="py-3 px-4 text-gray-600">{new Date(tx.transactionDate).toISOString().slice(0, 10)}</td>
                    <td className="py-3 px-4 text-gray-900 font-bold">{tx.reference || "—"}</td>
                    <td className="py-3 px-4 text-gray-700">{tx.description}</td>
                    <td className="py-3 px-4 text-right text-emerald-600 font-semibold">{tx.moneyIn > 0 ? formatCurrency(tx.moneyIn) : "—"}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-semibold">{tx.moneyOut > 0 ? formatCurrency(tx.moneyOut) : "—"}</td>
                    <td className="py-3 px-4 text-center">
                      {tx.status === "CLEARED" || tx.status === "RECONCILED" ? (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1.5 rounded uppercase tracking-wider shadow-sm select-none opacity-80 inline-flex items-center gap-1">{tx.status} 🔒</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1.5 rounded uppercase tracking-wider select-none inline-block">{tx.status}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleReverseTx(tx.id)} className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition shadow-sm">REVERSE</button>
                        <button onClick={() => handleDeleteTx(tx.id)} className="text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded transition shadow-sm">DELETE</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeposit && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-indigo-700 text-white flex justify-between items-center"><h2 className="text-lg font-bold">Quick Deposit</h2><button onClick={() => setShowDeposit(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button></div>
            <form onSubmit={handleDeposit} className="p-6 space-y-4 text-sm">
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Account to Credit (Source of Funds) *</span>
                <select required value={dForm.creditAccountId} onChange={(e) => setDForm({...dForm, creditAccountId: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none">
                  <option value="">-- Select GL Account --</option>
                  {depositAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Deposit Amount (PKR) *</span><input required type="number" min="0.01" step="0.01" value={dForm.amount} onChange={(e) => setDForm({...dForm, amount: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none font-bold" /></label>
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Date *</span><input required type="date" value={dForm.date} onChange={(e) => setDForm({...dForm, date: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none" /></label>
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Description *</span><input required type="text" placeholder="e.g., Owner Capital Injection" value={dForm.description} onChange={(e) => setDForm({...dForm, description: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none" /></label>
              <div className="pt-4 flex justify-end gap-3 border-t mt-4"><button type="button" onClick={() => setShowDeposit(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600">Cancel</button><button type="submit" disabled={depositing} className="px-5 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{depositing ? "Processing..." : "Record Deposit"}</button></div>
            </form>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-emerald-700 text-white flex justify-between items-center"><div><h2 className="text-lg font-bold">Clear Pending Payments</h2><p className="text-emerald-100 text-xs mt-1">Select the transactions you have verified on your bank statement.</p></div><button onClick={() => setShowClearModal(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button></div>
            <div className="overflow-y-auto p-0 flex-1">
              <table className="erp-data-table">
                <thead className="bg-gray-50 sticky top-0 border-b z-10 shadow-sm"><tr className="text-[11px] uppercase text-gray-500 font-bold"><th className="py-3 px-4 w-10"><input type="checkbox" className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer" onChange={(e) => setSelectedToClear(e.target.checked ? pendingTxs.map(t => t.id) : [])} checked={pendingTxs.length > 0 && selectedToClear.length === pendingTxs.length}/></th><th className="py-3 px-4">Date & Ref</th><th className="py-3 px-4">Description</th><th className="py-3 px-4 text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingTxs.length === 0 ? ( <tr><td colSpan={4} className="py-12 text-center text-gray-500 font-medium">No pending transactions available to clear.</td></tr> ) : (
                    pendingTxs.map(tx => (
                      <tr key={tx.id} className="hover:bg-emerald-50/50 transition cursor-pointer" onClick={() => setSelectedToClear(prev => prev.includes(tx.id) ? prev.filter(id => id !== tx.id) : [...prev, tx.id])}>
                        <td className="py-3 px-4"><input type="checkbox" checked={selectedToClear.includes(tx.id)} readOnly className="w-4 h-4 rounded text-emerald-600 border-gray-300 pointer-events-none" /></td>
                        <td className="py-3 px-4"><div className="font-bold text-gray-900">{tx.reference || "—"}</div><div className="text-xs text-gray-500">{new Date(tx.transactionDate).toISOString().slice(0, 10)}</div></td>
                        <td className="py-3 px-4 text-gray-700 text-xs">{tx.description}</td><td className={`py-3 px-4 text-right font-bold ${tx.moneyIn > 0 ? "text-emerald-600" : "text-rose-600"}`}>{tx.moneyIn > 0 ? `+ ${formatCurrency(tx.moneyIn)}` : `- ${formatCurrency(tx.moneyOut)}`}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center"><div className="text-sm font-bold text-gray-600">{selectedToClear.length} selected</div><div className="flex gap-3"><button onClick={() => setShowClearModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600 bg-white hover:bg-gray-50">Cancel</button><button onClick={handleBulkClear} disabled={clearing || selectedToClear.length === 0} className="px-5 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm">{clearing ? "Locking..." : `Clear & Lock`}</button></div></div>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-gray-900 text-white flex justify-between items-center"><h2 className="text-lg font-bold">Inter-Bank Transfer</h2><button onClick={() => setShowTransfer(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button></div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4 text-sm">
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Transfer To (Destination Bank) *</span><select required value={tForm.destBankId} onChange={(e) => setTForm({...tForm, destBankId: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none"><option value="">-- Select Bank Account --</option>{allBanks.filter(b => b.id !== id).map(b => <option key={b.id} value={b.id}>{b.bankName} ({b.accountNumber})</option>)}</select></label>
              <label className="flex flex-col gap-1.5"><span className="font-semibold text-gray-700">Amount to Transfer (PKR) *</span><input required type="number" min="0.01" step="0.01" value={tForm.amount} onChange={(e) => setTForm({...tForm, amount: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none font-bold" /></label>
              <div className="pt-4 flex justify-end gap-3 border-t mt-4"><button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600">Cancel</button><button type="submit" disabled={transferring} className="px-5 py-2 rounded-lg font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">{transferring ? "Processing..." : "Confirm Transfer"}</button></div>
            </form>
          </div>
        </div>
      )}
    </ERPShell>
  );
}