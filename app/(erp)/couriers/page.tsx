"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { 
  Truck, CheckCircle2, FileText, ArrowLeft, Printer, 
  Banknote, Plus, Search, Settings, X, Loader2, Save,
  Calendar, Landmark, CheckSquare, Square
} from "lucide-react";

export default function CourierLedgerPage() {
  const { formatAmount, currency } = useERPConfig();
  
  const [view, setView] = useState<"list" | "ledger" | "settings">("list");
  
  const [couriers, setCouriers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [activeCourier, setActiveCourier] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  // Date Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // New Courier Form
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [newCourier, setNewCourier] = useState({ name: "", phone: "", trackingUrl: "" });

  // Edit Courier Settings
  const [editCourier, setEditCourier] = useState({ name: "", phone: "", trackingUrl: "", depositAccountId: "" });
  const [savingSettings, setSavingSettings] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ 
    date: new Date().toISOString().split("T")[0], 
    depositAccountId: "", 
    amountReceived: "", 
    taxDeducted: "", 
    reference: "",
    selectedInvoices: [] as string[]
  });
  const [savingPayment, setSavingPayment] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      if (!company) throw new Error("Company not found");

      const [cData, iData, pData, bData] = await Promise.all([
        supabase.from("Courier").select("*").eq("companyId", company.id).order("name"),
        supabase.from("SalesInvoice").select(`*, customer:Customer(name)`).eq("companyId", company.id).not("courierId", "is", null),
        supabase.from("CourierPayment").select("*").eq("companyId", company.id),
        supabase.from("BankAccount").select("id, bankName, accountTitle, glAccountId").eq("companyId", company.id).order("bankName")
      ]);

      setCouriers(cData.data || []);
      setInvoices(iData.data || []);
      setPayments(pData.data || []);
      setBanks(bData.data || []);

    } catch (e: any) {
      console.error(e);
      alert("Failed to load data: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // --- LEDGER CALCULATION LOGIC WITH DATE FILTERS ---
  const { entries: ledgerData, openingBalance, closingBalance } = useMemo(() => {
    if (!activeCourier) return { entries: [], openingBalance: 0, closingBalance: 0 };

    const courierInvoices = invoices.filter(i => i.courierId === activeCourier.id);
    const courierPayments = payments.filter(p => p.courierId === activeCourier.id);

    let allEntries: any[] = [];

    courierInvoices.forEach(inv => {
      allEntries.push({
        date: new Date(inv.invoiceDate),
        description: `Invoice Booked - COD (${inv.invoiceNo})`,
        ref: inv.invoiceNo,
        debit: Number(inv.total),
        credit: 0,
      });
      allEntries.push({
        date: new Date(inv.invoiceDate),
        description: `Delivery Charges (${inv.invoiceNo})`,
        ref: inv.invoiceNo,
        debit: 0,
        credit: Number(inv.deliveryCharges),
      });
    });

    courierPayments.forEach(pmt => {
      allEntries.push({
        date: new Date(pmt.date),
        description: `Payment Received`,
        ref: pmt.reference || "PMT",
        debit: 0,
        credit: Number(pmt.amountReceived),
      });
      if (Number(pmt.taxDeducted) > 0) {
        allEntries.push({
          date: new Date(pmt.date),
          description: `W.H. Tax Deducted`,
          ref: pmt.reference || "TAX",
          debit: 0,
          credit: Number(pmt.taxDeducted),
        });
      }
    });

    // Sort all entries first
    allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let opBal = 0;
    let filteredEntries: any[] = [];

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    allEntries.forEach(entry => {
      if (start && entry.date < start) {
        opBal += (entry.debit - entry.credit);
      } else if (end && entry.date > end) {
        // Ignore future entries
      } else {
        filteredEntries.push(entry);
      }
    });

    let runningBal = opBal;
    const finalEntries = filteredEntries.map(entry => {
      runningBal += (entry.debit - entry.credit);
      return { ...entry, runningBalance: runningBal };
    });

    return { entries: finalEntries, openingBalance: opBal, closingBalance: runningBal };
  }, [activeCourier, invoices, payments, startDate, endDate]);

  const courierStats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    ledgerData.forEach(e => {
      totalDebit += e.debit;
      totalCredit += e.credit;
    });
    return { totalDebit, totalCredit };
  }, [ledgerData]);

  const pendingInvoices = useMemo(() => {
    if (!activeCourier) return [];
    return invoices.filter(i => i.courierId === activeCourier.id && i.status === "POSTED");
  }, [activeCourier, invoices]);

  const selectedInvoiceTotals = useMemo(() => {
    let cod = 0;
    let fees = 0;
    pendingInvoices.forEach(inv => {
      if (paymentData.selectedInvoices.includes(inv.id)) {
        cod += Number(inv.total);
        fees += Number(inv.deliveryCharges);
      }
    });
    return { cod, fees, expected: cod - fees };
  }, [paymentData.selectedInvoices, pendingInvoices]);

  // --- ACTIONS ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const selectedBank = banks.find(b => b.id === editCourier.depositAccountId);
      
      const { error } = await supabase
        .from("Courier")
        .update({
          name: editCourier.name,
          phone: editCourier.phone,
          trackingUrl: editCourier.trackingUrl,
          depositAccountId: selectedBank ? selectedBank.glAccountId : null,
          updatedAt: new Date().toISOString()
        })
        .eq("id", activeCourier.id);

      if (error) throw error;
      alert("Courier settings updated.");
      await loadData();
      setView("list");
    } catch (err: any) {
      alert("Failed to update courier: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentData.selectedInvoices.length === 0) return alert("Please select at least one invoice to settle.");
    
    setSavingPayment(true);
    try {
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      
      const { error: payErr } = await supabase.from("CourierPayment").insert({
        id: crypto.randomUUID(),
        companyId: company?.id,
        courierId: activeCourier.id,
        date: new Date(paymentData.date).toISOString(),
        depositAccountId: activeCourier.depositAccountId,
        amountReceived: Number(paymentData.amountReceived),
        taxDeducted: Number(paymentData.taxDeducted) || 0,
        reference: paymentData.reference,
        invoiceIds: paymentData.selectedInvoices,
        createdAt: new Date().toISOString()
      });

      if (payErr) throw payErr;

      const { error: invErr } = await supabase
        .from("SalesInvoice")
        .update({ status: "RECONCILED", updatedAt: new Date().toISOString() })
        .in("id", paymentData.selectedInvoices);

      if (invErr) throw invErr;
      
      setShowPaymentModal(false);
      setPaymentData({ 
        date: new Date().toISOString().split("T")[0], 
        depositAccountId: "", 
        amountReceived: "", 
        taxDeducted: "", 
        reference: "",
        selectedInvoices: []
      });
      await loadData(); 
    } catch (err: any) {
      alert("Failed to record payment: " + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const openPaymentModal = () => {
    if (!activeCourier.depositAccountId) {
      return alert("Please go to Settings and select a Default Deposit Account for this courier first.");
    }
    setPaymentData(prev => ({ ...prev, depositAccountId: activeCourier.depositAccountId }));
    setShowPaymentModal(true);
  };

  if (loading && couriers.length === 0) return <div className="p-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  // Build Print URL with filters
  const printUrl = activeCourier 
    ? `/couriers/${activeCourier.id}/print?${new URLSearchParams({
        ...(startDate && { start: startDate }),
        ...(endDate && { end: endDate })
      }).toString()}` 
    : "#";

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-teal-500" />
            {view === "list" ? "Courier Management" : `${activeCourier?.name} - ${view === "ledger" ? "Running Ledger" : "Settings"}`}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {view === "list" ? "Manage courier accounts and view running balances." : "Chronological statement of COD, fees, and payments."}
          </p>
        </div>
        <div className="flex gap-3">
          {view === "list" && (
            <button onClick={() => setShowCourierForm(true)} className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm shadow-lg shadow-teal-500/20">
              <Plus className="w-4 h-4" /> Add Courier
            </button>
          )}
          {view !== "list" && (
            <button onClick={() => setView("list")} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm border border-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to List
            </button>
          )}
        </div>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-zinc-950/50 border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              <tr>
                <th className="p-4">Courier Partner</th>
                <th className="p-4 text-right">Current Balance</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {couriers.map(c => {
                const cInvoices = invoices.filter(i => i.courierId === c.id);
                const cPayments = payments.filter(p => p.courierId === c.id);
                let bal = 0;
                cInvoices.forEach(i => bal += (Number(i.total) - Number(i.deliveryCharges)));
                cPayments.forEach(p => bal -= (Number(p.amountReceived) + Number(p.taxDeducted)));

                return (
                  <tr key={c.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-xs text-zinc-500">{cInvoices.length} Total Invoices</div>
                    </td>
                    <td className={`p-4 text-right font-bold font-mono ${bal > 0 ? 'text-emerald-400' : bal < 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                      {currency} {formatAmount(bal)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => { 
                            setActiveCourier(c); 
                            setEditCourier({ name: c.name, phone: c.phone || "", trackingUrl: c.trackingUrl || "", depositAccountId: banks.find(b => b.glAccountId === c.depositAccountId)?.id || "" }); 
                            setView("settings"); 
                          }} 
                          className="p-2 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors" 
                          title="Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setActiveCourier(c); setView("ledger"); }} className="px-4 py-1.5 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-white rounded-lg transition-colors shadow-lg shadow-teal-500/20 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Open Ledger</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* LEDGER VIEW */}
      {view === "ledger" && activeCourier && (
        <div className="space-y-6">
          
          {/* Filter Bar */}
          <div className="bg-zinc-900/60 backdrop-blur-xl p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">From Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none [color-scheme:dark]" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">To Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none [color-scheme:dark]" />
            </div>
            <button onClick={() => { setStartDate(""); setEndDate(""); }} className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
              Clear Filter
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Opening Balance</div>
              <div className="text-xl font-black font-mono text-zinc-300">{currency} {formatAmount(openingBalance)}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Period Debit (COD)</div>
              <div className="text-xl font-black font-mono text-emerald-400">{currency} {formatAmount(courierStats.totalDebit)}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Period Credit (Settled)</div>
              <div className="text-xl font-black font-mono text-rose-400">{currency} {formatAmount(courierStats.totalCredit)}</div>
            </div>
            <div className="bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5 border-b-4 border-b-teal-500">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Closing Balance</div>
              <div className={`text-2xl font-black font-mono ${closingBalance > 0 ? 'text-emerald-400' : closingBalance < 0 ? 'text-rose-400' : 'text-white'}`}>
                {currency} {formatAmount(closingBalance)}
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
              <span className="text-sm font-bold text-white">Chronological Ledger</span>
              <div className="flex gap-2">
                <button onClick={openPaymentModal} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                  <Banknote className="w-4 h-4" /> Record Payment
                </button>
                <Link href={printUrl} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Print Ledger
                </Link>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-zinc-950/50 border-b border-white/5 text-[10px] uppercase text-zinc-500 font-bold">
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Reference</th>
                    <th className="p-4 text-right">Debit (Owed to Us)</th>
                    <th className="p-4 text-right">Credit (We Owe)</th>
                    <th className="p-4 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {/* Opening Balance Row */}
                  {startDate && (
                    <tr className="bg-black/30">
                      <td className="p-4 text-sm text-zinc-400">{startDate}</td>
                      <td className="p-4 text-sm font-bold text-white" colSpan={4}>Opening Balance Brought Forward</td>
                      <td className="p-4 text-right font-bold font-mono text-zinc-300">{formatAmount(openingBalance)}</td>
                    </tr>
                  )}

                  {ledgerData.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 text-sm text-zinc-400">{row.date.toISOString().slice(0, 10)}</td>
                      <td className="p-4 text-sm font-medium text-white">{row.description}</td>
                      <td className="p-4 text-sm font-mono text-zinc-500">{row.ref}</td>
                      <td className="p-4 text-right font-mono text-emerald-400">{row.debit > 0 ? formatAmount(row.debit) : "—"}</td>
                      <td className="p-4 text-right font-mono text-rose-400">{row.credit > 0 ? formatAmount(row.credit) : "—"}</td>
                      <td className={`p-4 text-right font-bold font-mono ${row.runningBalance > 0 ? 'text-emerald-400' : row.runningBalance < 0 ? 'text-rose-400' : 'text-white'}`}>
                        {formatAmount(row.runningBalance)}
                      </td>
                    </tr>
                  ))}
                  {ledgerData.length === 0 && (
                    <tr><td colSpan={6} className="p-12 text-center text-zinc-500">No transactions found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS VIEW */}
      {view === "settings" && activeCourier && (
        <div className="bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-teal-500"/> Courier Integration Settings</h2>
          
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Courier Name</label>
              <input required value={editCourier.name} onChange={e => setEditCourier({...editCourier, name: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Contact Phone</label>
              <input value={editCourier.phone} onChange={e => setEditCourier({...editCourier, phone: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Default Deposit Account</label>
              <select value={editCourier.depositAccountId} onChange={e => setEditCourier({...editCourier, depositAccountId: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none">
                <option value="">Select Default Bank...</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.bankName} - {b.accountTitle}</option>)}
              </select>
            </div>
            
            <button type="submit" disabled={savingSettings} className="w-full mt-4 bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </form>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentModal && activeCourier && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
              <h2 className="text-xl font-bold text-white">Record Courier Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-white/5 pb-2">Payment Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">Date Received</label>
                    <input type="date" required value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">Reference</label>
                    <input value={paymentData.reference} onChange={e => setPaymentData({...paymentData, reference: e.target.value})} placeholder="Bank Ref" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">Deposit Account (Locked from Settings)</label>
                  <input readOnly value={banks.find(b => b.glAccountId === activeCourier.depositAccountId)?.bankName + " - " + banks.find(b => b.glAccountId === activeCourier.depositAccountId)?.accountTitle || "Bank Not Set"} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-400 outline-none cursor-not-allowed" />
                </div>

                <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-3">
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Selected COD Total</span>
                    <span className="font-mono">{formatAmount(selectedInvoiceTotals.cod)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-400">
                    <span>Courier Fees Deducted</span>
                    <span className="font-mono">- {formatAmount(selectedInvoiceTotals.fees)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white border-t border-white/10 pt-2">
                    <span>Expected Net Amount</span>
                    <span className="font-mono text-teal-400">{formatAmount(selectedInvoiceTotals.expected)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">Actual Amount Received</label>
                    <input required type="number" step="0.01" value={paymentData.amountReceived} onChange={e => setPaymentData({...paymentData, amountReceived: e.target.value})} placeholder="0.00" className="w-full bg-zinc-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1.5">W.H. Tax Deducted</label>
                    <input type="number" step="0.01" value={paymentData.taxDeducted} onChange={e => setPaymentData({...paymentData, taxDeducted: e.target.value})} placeholder="0.00" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex flex-col">
                <h3 className="text-sm font-bold text-teal-400 uppercase tracking-widest border-b border-white/5 pb-2 flex justify-between items-center">
                  <span>Select Invoices to Settle</span>
                </h3>
                
                <div className="flex-1 overflow-y-auto border border-white/10 rounded-xl bg-zinc-950">
                  {pendingInvoices.length === 0 ? (
                    <div className="p-6 text-center text-zinc-500 text-sm">No pending invoices.</div>
                  ) : (
                    pendingInvoices.map(inv => {
                      const isSelected = paymentData.selectedInvoices.includes(inv.id);
                      return (
                        <div 
                          key={inv.id} 
                          onClick={() => {
                            const newSelected = isSelected 
                              ? paymentData.selectedInvoices.filter(id => id !== inv.id)
                              : [...paymentData.selectedInvoices, inv.id];
                            setPaymentData({ ...paymentData, selectedInvoices: newSelected });
                          }}
                          className={`flex items-center justify-between p-3 border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-teal-500/10' : 'hover:bg-white/5'}`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-teal-500" /> : <Square className="w-4 h-4 text-zinc-500" />}
                            <div>
                              <div className="text-sm font-bold text-white">{inv.invoiceNo}</div>
                              <div className="text-xs text-zinc-500">{inv.customer?.name || "Guest"}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono text-white font-bold">{formatAmount(inv.total)}</div>
                            <div className="text-xs text-rose-400 font-mono">Fee: {formatAmount(inv.deliveryCharges)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowPaymentModal(false)} className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleRecordPayment} disabled={savingPayment || paymentData.selectedInvoices.length === 0} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2">
                {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD COURIER MODAL */}
      {showCourierForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h2 className="text-xl font-bold text-white">Add Courier Partner</h2>
              <button onClick={() => setShowCourierForm(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddCourier} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Courier Name</label>
                <input required value={newCourier.name} onChange={e => setNewCourier({...newCourier, name: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                <input value={newCourier.phone} onChange={e => setNewCourier({...newCourier, phone: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
              </div>
              <button type="submit" className="w-full mt-4 bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20">
                Save Courier
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}