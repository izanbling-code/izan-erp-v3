"use client";

import { useState, useEffect, useMemo } from "react";
import { Truck, CheckCircle2, FileText, RotateCcw, ArrowLeft, Printer, AlertCircle, Banknote, Package } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function CourierManagementPage() {
  const { formatAmount, currency } = useERPConfig("general");
  
  const [view, setView] = useState<"list" | "reconcile" | "ledger">("list");
  const [couriers, setCouriers] = useState<any[]>([]);
  const [activeCourier, setActiveCourier] = useState<any>(null);
  
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [actualFees, setActualFees] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const cRes = await fetch("/api/couriers");
      const cData = await cRes.json();
      if (cData.success) setCouriers(cData.couriers);
    } catch (e) { console.error("Failed to fetch data"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const pendingInvoices = useMemo(() => {
    if (!activeCourier || !activeCourier.invoices) return [];
    return activeCourier.invoices.filter((i: any) => i.status === "POSTED");
  }, [activeCourier]);

  const reconciledInvoices = useMemo(() => {
    if (!activeCourier || !activeCourier.invoices) return [];
    return activeCourier.invoices.filter((i: any) => i.status === "RECONCILED");
  }, [activeCourier]);

  // Aggregate List View Totals
  const getCourierStats = (c: any) => {
    let pendingCOD = 0; let pendingPayable = 0;
    let paidCOD = 0; let paidFees = 0;
    
    (c.invoices || []).forEach((inv: any) => {
      const total = Number(inv.total) || 0;
      const fee = Number(inv.deliveryCharges) || 0;
      if (inv.status === "POSTED") { pendingCOD += total; pendingPayable += fee; }
      if (inv.status === "RECONCILED") { paidCOD += total; paidFees += fee; }
    });
    return { pendingCOD, pendingPayable, paidCOD, paidFees };
  };

  // Reconcile Screen Selection Logic
  const handleSelect = (inv: any, checked: boolean) => {
    if (checked) {
      setSelectedInvoices(p => [...p, inv.id]);
      setActualFees(p => ({ ...p, [inv.id]: Number(inv.deliveryCharges) || 0 }));
    } else {
      setSelectedInvoices(p => p.filter(id => id !== inv.id));
      setActualFees(p => { const newFees = {...p}; delete newFees[inv.id]; return newFees; });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(pendingInvoices.map((i: any) => i.id));
      const fees: Record<string, number> = {};
      pendingInvoices.forEach((i: any) => fees[i.id] = Number(i.deliveryCharges) || 0);
      setActualFees(fees);
    } else {
      setSelectedInvoices([]);
      setActualFees({});
    }
  };

  const previewTotals = useMemo(() => {
    let cod = 0, billedFee = 0, actualFee = 0;
    const selected = pendingInvoices.filter((i: any) => selectedInvoices.includes(i.id));
    
    selected.forEach((i: any) => {
      billedFee += Number(i.deliveryCharges) || 0;
      actualFee += actualFees[i.id] ?? (Number(i.deliveryCharges) || 0);
      cod += Number(i.total) || 0;
    });
    
    const variance = billedFee - actualFee; 
    return { cod, billedFee, actualFee, variance, netPayout: cod - actualFee };
  }, [selectedInvoices, pendingInvoices, actualFees]);

  const openReconcile = (courier: any) => { setActiveCourier(courier); setSelectedInvoices([]); setActualFees({}); setView("reconcile"); };
  const openLedger = (courier: any) => { setActiveCourier(courier); setView("ledger"); };

  const handlePostReconciliation = async () => {
    if (selectedInvoices.length === 0) return alert("Select at least one invoice.");
    setProcessing(true);
    
    const payload = selectedInvoices.map(id => ({ id, actualFee: actualFees[id] ?? 0 }));
    
    try {
      const res = await fetch("/api/couriers/reconcile", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courierId: activeCourier.id, items: payload })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully posted Remittance Batch: ${data.batchRef}`);
        await fetchData(); setView("list");
      } else alert("Reconciliation failed: " + data.error);
    } catch (e) { alert("Network error."); } finally { setProcessing(false); }
  };

  const extractNote = (notes: string, key: string) => {
    if (!notes) return "N/A";
    const regex = new RegExp(`${key}:\\s*([^|\\n]+)`, "i");
    const match = notes.match(regex);
    return match ? match[1].trim() : "N/A";
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold tracking-widest uppercase animate-pulse">Loading Courier Framework...</div>;

  return (
    <div className="space-y-6 relative z-10 w-full pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-teal-500" />
            {view === "list" ? "Courier Management" : `${activeCourier?.name} - ${view === "reconcile" ? "Reconciliation" : "Settlement Ledger"}`}
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            {view === "list" ? "Manage active payables, receivables, and profit margins" : "Review shipments, log actual fees, and process general ledger entries"}
          </p>
        </div>
        {view !== "list" && (
          <button onClick={() => setView("list")} className="bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
        )}
      </div>

      {view === "list" && (
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-slate-50/50 dark:bg-zinc-950/30 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5"><tr>
              <th className="p-4">Courier Partner</th>
              <th className="p-4 text-right">Active Payable (Fees)</th>
              <th className="p-4 text-right">Active Receivable (COD)</th>
              <th className="p-4 text-right">Settled Volume</th>
              <th className="p-4 text-right">Actions</th>
            </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {couriers.map(c => {
                const stats = getCourierStats(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.invoices?.filter((i:any)=>i.status==="POSTED").length || 0} Pending Shipments</div>
                    </td>
                    <td className="p-4 text-right font-bold text-rose-500 font-mono">{currency} {formatAmount(stats.pendingPayable)}</td>
                    <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currency} {formatAmount(stats.pendingCOD)}</td>
                    <td className="p-4 text-right font-bold text-slate-600 dark:text-zinc-300 font-mono">{currency} {formatAmount(stats.paidCOD)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openLedger(c)} className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Ledger</button>
                        <button onClick={() => openReconcile(c)} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-teal-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Reconcile</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </div>
      )}

      {view === "reconcile" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-4 flex justify-between items-center border-b border-slate-200/60 dark:border-white/5">
              <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Pending Settlements ({pendingInvoices.length})</span>
            </div>
            <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
              {pendingInvoices.length === 0 ? (
                <div className="p-12 text-center text-slate-500"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20"/>No pending invoices to reconcile.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap"><thead className="sticky top-0 bg-slate-50 dark:bg-zinc-950 z-10 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5"><tr>
                  <th className="p-4 w-12 text-center"><input type="checkbox" className="accent-teal-500 w-4 h-4 rounded cursor-pointer" checked={selectedInvoices.length === pendingInvoices.length && pendingInvoices.length > 0} onChange={e => handleSelectAll(e.target.checked)} /></th>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Tracking</th>
                  <th className="p-4 text-right">Billed to Cust.</th>
                  <th className="p-4 text-center">Actual Courier Fee</th>
                  <th className="p-4 text-right">Expected COD</th>
                </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {pendingInvoices.map((inv: any) => {
                    const isSelected = selectedInvoices.includes(inv.id);
                    const billed = Number(inv.deliveryCharges) || 0;
                    return (
                      <tr key={inv.id} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isSelected ? 'bg-teal-50/50 dark:bg-teal-500/5' : ''}`}>
                        <td className="p-4 text-center"><input type="checkbox" className="accent-teal-500 w-4 h-4 rounded cursor-pointer" checked={isSelected} onChange={e => handleSelect(inv, e.target.checked)} /></td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{inv.invoiceNo}</td>
                        <td className="p-4 text-slate-500 font-mono text-xs">{extractNote(inv.notes, "Tracking")}</td>
                        <td className="p-4 text-right text-rose-500 font-mono">{formatAmount(billed)}</td>
                        <td className="p-4 text-center">
                           <input type="number" min="0" disabled={!isSelected} value={actualFees[inv.id] ?? billed} onChange={e => setActualFees(p => ({...p, [inv.id]: Number(e.target.value)}))} className="w-24 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-1.5 text-right font-mono text-sm outline-none focus:border-teal-500 disabled:opacity-50" />
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatAmount(Number(inv.total) || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody></table>
              )}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-6 h-fit shadow-sm flex flex-col sticky top-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"><Banknote className="w-5 h-5 text-teal-500"/> Remittance Summary</h2>
            
            <div className="space-y-4 flex-1">
              <div className="flex justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <span className="text-sm font-medium text-slate-500">Gross COD (Asset)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{currency} {formatAmount(previewTotals.cod)}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <span className="text-sm font-medium text-slate-500">Actual Courier Fee (Expense)</span>
                <span className="font-bold text-rose-500 font-mono">{currency} {formatAmount(previewTotals.actualFee)}</span>
              </div>
              
              <div className="flex justify-between pt-2 pb-2 px-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <span className="text-xs font-bold text-slate-500 uppercase">Variance {previewTotals.variance >= 0 ? '(Income)' : '(Expense)'}</span>
                <span className={`font-bold font-mono text-sm ${previewTotals.variance > 0 ? 'text-teal-600 dark:text-teal-400' : previewTotals.variance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>
                   {previewTotals.variance > 0 ? '+' : ''}{formatAmount(previewTotals.variance)}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t-2 border-slate-200 dark:border-white/10">
              <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Bank Deposit</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{currency} {formatAmount(previewTotals.netPayout)}</span>
              </div>
              <button onClick={handlePostReconciliation} disabled={processing || selectedInvoices.length === 0} className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
                {processing ? "Posting..." : <><CheckCircle2 className="w-4 h-4"/> Post Remittance Batch</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEDGER VIEW */}
      {view === "ledger" && (
        <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-white/5 overflow-hidden shadow-sm">
          <div className="bg-slate-50/50 dark:bg-zinc-950/30 p-4 flex justify-between items-center border-b border-slate-200/60 dark:border-white/5 print:hidden">
            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300">Reconciled Historical Ledger</span>
            <button onClick={() => window.print()} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><Printer className="w-4 h-4" /> Export</button>
          </div>
          <div className="p-6 print:block">
            {reconciledInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-500 print:hidden">No reconciled invoices found.</div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap"><thead className="bg-slate-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5"><tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Tracking Number</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Billed to Cust.</th>
                <th className="p-4 text-right">Settled COD</th>
              </tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {reconciledInvoices.map((inv: any) => {
                  const billed = Number(inv.deliveryCharges) || 0;
                  const cod = Number(inv.total) || 0;
                  const isCOD = cod > 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{inv.invoiceNo}</td>
                      <td className="p-4 text-slate-500 font-mono text-xs">{extractNote(inv.notes, "Tracking")}</td>
                      <td className="p-4 text-center">
                         <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${isCOD ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{isCOD ? "COD" : "NON-COD"}</span>
                      </td>
                      <td className="p-4 text-right text-rose-500 font-mono">{formatAmount(billed)}</td>
                      <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatAmount(cod)}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.6); }
        .print-only { display: none; }
        @media print {
          @page { margin: 1cm; }
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { display: block !important; }
          .print\\:block { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:block * { visibility: visible; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}