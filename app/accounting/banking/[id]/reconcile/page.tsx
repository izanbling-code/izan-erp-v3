"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

type ERPTx = { id: string; transactionDate: string; reference: string; description: string; moneyIn: number; moneyOut: number; status: string; net: number; };
type StatementLine = { id: string; date: string; description: string; amount: number; matchedToId: string | null; };
type Account = { id: string; name: string; systemCode: string; };

export default function BankReconciliationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  
  const [bank, setBank] = useState<any>(null);
  const [glAccounts, setGlAccounts] = useState<Account[]>([]);
  const [erpTransactions, setErpTransactions] = useState<ERPTx[]>([]);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Manual Matching State
  const [selectedCsvId, setSelectedCsvId] = useState<string | null>(null);

  // Quick Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ date: "", description: "", amount: 0, offsetAccountId: "", lineId: "" });

  useEffect(() => {
    async function loadData() {
      try {
        const [bankRes, glRes] = await Promise.all([
          fetch(`/api/banking/accounts/${id}`),
          fetch(`/api/accounting/cashbook/accounts`) // Fetch all accounts for adjustment offsets
        ]);
        const bankJson = await bankRes.json();
        const glJson = await glRes.json();
        
        if (bankJson.ok) {
          setBank(bankJson.bankAccount);
          const unreconciled = bankJson.transactions
            .filter((tx: any) => tx.status !== "RECONCILED")
            .map((tx: any) => ({ ...tx, net: Number(tx.moneyIn) - Number(tx.moneyOut) }));
          setErpTransactions(unreconciled);
        }
        if (glJson.ok) setGlAccounts(glJson.accounts);
      } finally { setLoading(false); }
    }
    loadData();
  }, [id]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setSelectedCsvId(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split("\n").map(r => r.split(","));
        const parsed = rows.slice(1).map((r, i) => {
          if (r.length < 3) return null;
          const amt = parseFloat(r[2].replace(/[^0-9.-]+/g,""));
          if (isNaN(amt)) return null;
          return { id: `stm-${i}`, date: r[0], description: r[1], amount: amt, matchedToId: null };
        }).filter(Boolean) as StatementLine[];
        setStatementLines(parsed);
      } catch (err) {
        setUploadError("Invalid CSV format. Columns must be: Date, Description, Amount.");
      }
    };
    reader.readAsText(file);
  };

  const runAutoMatch = () => {
    const newErp = [...erpTransactions];
    const newLines = [...statementLines];
    newLines.forEach(line => {
      if (line.matchedToId) return;
      const matchIdx = newErp.findIndex(erp => erp.net === line.amount && !erp.status.includes("MATCHED"));
      if (matchIdx !== -1) {
        line.matchedToId = newErp[matchIdx].id;
        newErp[matchIdx].status = "MATCHED";
      }
    });
    setStatementLines(newLines);
    setErpTransactions(newErp);
  };

  // --- MANUAL MATCHING LOGIC ---
  const handleCsvClick = (line: StatementLine) => {
    if (line.matchedToId) return; // Can't select already matched
    setSelectedCsvId(selectedCsvId === line.id ? null : line.id);
  };

  const handleErpClick = (tx: ERPTx) => {
    if (!selectedCsvId || tx.status.includes("MATCHED")) return;
    
    // Link them manually!
    const newLines = [...statementLines];
    const newErp = [...erpTransactions];
    
    const lineIdx = newLines.findIndex(l => l.id === selectedCsvId);
    const erpIdx = newErp.findIndex(e => e.id === tx.id);
    
    newLines[lineIdx].matchedToId = newErp[erpIdx].id;
    newErp[erpIdx].status = "MATCHED";
    
    setStatementLines(newLines);
    setErpTransactions(newErp);
    setSelectedCsvId(null); // Clear selection
  };

  const unmatch = (lineId: string, erpId: string) => {
    const newLines = [...statementLines];
    const newErp = [...erpTransactions];
    
    const lineIdx = newLines.findIndex(l => l.id === lineId);
    const erpIdx = newErp.findIndex(e => e.id === erpId);
    
    if (lineIdx > -1) newLines[lineIdx].matchedToId = null;
    if (erpIdx > -1) newErp[erpIdx].status = "PENDING"; // Reset status
    
    setStatementLines(newLines);
    setErpTransactions(newErp);
  };

  // --- ON THE FLY ADJUSTMENTS ---
  const openAddModal = (line: StatementLine) => {
    setAddForm({ date: line.date, description: line.description, amount: line.amount, offsetAccountId: "", lineId: line.id });
    setShowAddModal(true);
  };

  const submitQuickAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isMoneyIn = addForm.amount > 0;
      const res = await fetch(`/api/banking/accounts/${id}/adjust`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, isMoneyIn })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      
      // Add the new transaction to the ERP list and auto-match it!
      const newTx = json.transaction;
      const newErp = [newTx, ...erpTransactions];
      const newLines = [...statementLines];
      
      const lineIdx = newLines.findIndex(l => l.id === addForm.lineId);
      newLines[lineIdx].matchedToId = newTx.id;
      
      setErpTransactions(newErp);
      setStatementLines(newLines);
      setShowAddModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post adjustment.");
    } finally {
      setSaving(false);
    }
  };

  // --- COMMIT RECONCILIATION ---
  const commitReconciliation = async () => {
    const matchedTxIds = erpTransactions.filter(tx => tx.status === "MATCHED").map(tx => tx.id);
    if (matchedTxIds.length === 0) return alert("No transactions matched to reconcile.");
    setSaving(true);
    try {
      const res = await fetch(`/api/banking/accounts/${id}/reconcile`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedTxIds })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      alert(`Success! ${matchedTxIds.length} transactions permanently reconciled.`);
      router.push(`/accounting/banking/${id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  };

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);
  const matchedCount = statementLines.filter(l => l.matchedToId).length;

  if (loading) return <ERPShell><div className="p-10 text-center text-gray-500">Loading Auto-Reconciler...</div></ERPShell>;

  return (
    <ERPShell>
      <div className="max-w-7xl mx-auto p-6 space-y-6 text-sm">
        <div className="bg-gray-900 p-6 rounded-xl shadow-sm text-white flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="mb-1"><Link href={`/accounting/banking/${id}`} className="text-gray-400 hover:text-white transition">← Back to Control Panel</Link></div>
            <h1 className="text-xl font-bold">Pro-Reconciler: {bank?.bankName}</h1>
            <p className="text-gray-400 text-xs mt-1">Upload CSV. Auto-Match, Manually Click to Match, or Add Missing Entries.</p>
          </div>
          <div className="flex items-center gap-3 bg-gray-800 p-3 rounded-lg border border-gray-700">
            <span className="text-xs font-semibold text-gray-300">1. Upload CSV:</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer" />
          </div>
        </div>

        {uploadError && <div className="p-4 bg-rose-50 text-rose-700 rounded-lg font-medium border border-rose-200">{uploadError}</div>}
        
        {statementLines.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
            <div className="text-gray-700 font-medium">Loaded <strong className="text-gray-900">{statementLines.length}</strong> statement lines. Matched: <strong className="text-emerald-600">{matchedCount}</strong></div>
            <div className="flex gap-3">
              <button onClick={runAutoMatch} className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold py-2 px-5 rounded-lg transition shadow-sm">⚡ Run Auto-Match</button>
              <button onClick={commitReconciliation} disabled={saving || matchedCount === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg transition shadow-sm disabled:opacity-50">{saving ? "Saving..." : "Lock & Commit Reconciled"}</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BANK STATEMENT */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50"><h2 className="font-bold text-gray-700">1. Bank Statement (CSV)</h2></div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {statementLines.length === 0 ? <div className="h-full flex items-center justify-center text-gray-400">Upload a CSV file to begin.</div> : (
                statementLines.map(line => (
                  <div 
                    key={line.id} 
                    onClick={() => handleCsvClick(line)}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center transition 
                      ${line.matchedToId ? "bg-emerald-50 border-emerald-200 opacity-70" : 
                        selectedCsvId === line.id ? "bg-blue-50 border-blue-500 shadow-md cursor-pointer ring-2 ring-blue-200" : "bg-white border-gray-200 hover:border-blue-300 cursor-pointer"}`}
                  > 
                    <div>
                      <div className="font-semibold text-gray-900">{line.date}</div>
                      <div className="text-gray-500 mt-0.5">{line.description}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`font-bold ${line.amount > 0 ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(line.amount)}</div>
                        {line.matchedToId && <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Matched ✓</div>}
                      </div>
                      {/* QUICK ADD / UNMATCH BUTTONS */}
                      {!line.matchedToId && (
                        <button onClick={(e) => { e.stopPropagation(); openAddModal(line); }} className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center transition">
                          +
                        </button>
                      )}
                      {line.matchedToId && (
                        <button onClick={(e) => { e.stopPropagation(); unmatch(line.id, line.matchedToId as string); }} className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1 bg-white border border-rose-200 rounded">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ERP SUBLEDGER */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-700">2. ERP Subledger (Unreconciled)</h2>
              {selectedCsvId && <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 animate-pulse">Click a transaction below to match 👆</div>}
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {erpTransactions.map(tx => (
                <div 
                  key={tx.id} 
                  onClick={() => handleErpClick(tx)}
                  className={`p-3 rounded-lg border text-xs flex justify-between items-center transition 
                    ${tx.status === "MATCHED" ? "bg-emerald-50 border-emerald-200 opacity-70" : 
                      selectedCsvId ? "bg-white border-blue-200 hover:bg-blue-50 cursor-pointer shadow-sm" : "bg-white border-gray-200"}`}
                > 
                  <div>
                    <div className="font-semibold text-gray-900">{new Date(tx.transactionDate).toISOString().slice(0, 10)} - {tx.reference}</div>
                    <div className="text-gray-500 mt-0.5">{tx.description}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${tx.net > 0 ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(tx.net)}</div>
                    {tx.status === "MATCHED" ? <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-1">Matched ✓</div> : <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{tx.status}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ON-THE-FLY ADJUSTMENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Add Missing Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button>
            </div>
            
            <form onSubmit={submitQuickAdd} className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium mb-4">
                This will instantly post a Journal Entry to the General Ledger and match it to the statement line.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 col-span-2">
                  <span className="font-semibold text-gray-700">Bank Statement Description</span>
                  <input value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none" required />
                </label>
                
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold text-gray-700">Date</span>
                  <input type="date" value={addForm.date} onChange={e => setAddForm({...addForm, date: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none" required />
                </label>
                
                <label className="flex flex-col gap-1.5">
                  <span className="font-semibold text-gray-700">Amount (PKR)</span>
                  <input type="number" value={addForm.amount} disabled className={`border rounded-md p-2.5 bg-gray-100 font-bold outline-none ${addForm.amount > 0 ? "text-emerald-700" : "text-rose-700"}`} />
                </label>
                
                <label className="flex flex-col gap-1.5 col-span-2 pt-2 border-t mt-1">
                  <span className="font-semibold text-gray-700">Offset Account (Where did this money come from/go?) *</span>
                  <select required value={addForm.offsetAccountId} onChange={e => setAddForm({...addForm, offsetAccountId: e.target.value})} className="border rounded-md p-2.5 bg-gray-50 outline-none">
                    <option value="">-- Select GL Account --</option>
                    {glAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-gray-600">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">
                  {saving ? "Posting..." : "Post & Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </ERPShell>
  );
}