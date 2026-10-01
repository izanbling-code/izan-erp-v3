"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";
import { Plus, Edit, Printer, CreditCard, FileText, CheckCircle, Globe, PackageOpen } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

type InvoiceLine = { id: string; productId: string; warehouseId: string; batchId: string; quantity: number; unitPrice: number; discount: number; tax: number; };

export default function UnifiedInvoicesDashboard() {
  const { config: salesConfig, settings, formatAmount, currency } = useERPConfig("sales");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"draft" | "posted" | "web">("draft");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPostedEdit, setIsPostedEdit] = useState(false);
  
  // Form State
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockBatches, setStockBatches] = useState<any[]>([]);
  
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [globalDiscountType, setGlobalDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [globalDiscountVal, setGlobalDiscountVal] = useState(0);
  const [globalTax, setGlobalTax] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);

  const tabs = [
    { id: "draft", label: "Drafts", icon: <FileText className="w-4 h-4" /> },
    { id: "posted", label: "Posted & Paid", icon: <CheckCircle className="w-4 h-4" /> },
    { id: "web", label: "Web Orders", icon: <Globe className="w-4 h-4" /> }
  ] as const;

  useEffect(() => { loadInvoices(); }, [activeTab, search]);

  useEffect(() => {
    if (showModal && customers.length === 0) {
      Promise.all([fetch("/api/sales/customers"), fetch("/api/stock")]).then(async ([cRes, sRes]) => {
        const cData = await cRes.json();
        const sData = await sRes.json();
        setCustomers(Array.isArray(cData) ? cData : cData?.customers || []);
        setProducts(sData.products || []);
        setWarehouses(sData.warehouses || []);
        setStockBatches(sData.stockBatches || []);
      });
    }
  }, [showModal]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/invoices?tab=${activeTab}&search=${search}`);
      const data = await res.json();
      if (data.ok) { 
        setInvoices(data.invoices); 
        setSelectedIds([]); 
      } else {
        toast.error(data.error || "Failed to load invoices.");
      }
    } catch (err) { 
      toast.error("Network error.");
    } finally { setLoading(false); }
  }

  const toggleSelect = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  async function bulkPost() {
    if (selectedIds.length === 0) return toast.error("Select invoices to post.");
    if (!window.confirm(`Post ${selectedIds.length} invoices to the General Ledger?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/sales/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "BULK_POST", ids: selectedIds }) });
      const j = await res.json();
      if (j.ok) { toast.success(j.message); loadInvoices(); } else toast.error(j.error);
    } catch (err) { toast.error("Failed to post."); } finally { setBusy(false); }
  }

  function openNewInvoice() {
    setEditingId(null); setIsPostedEdit(false); setFormCustomerId(""); setFormNotes(""); setLines([]);
    setGlobalDiscountVal(0); setGlobalTax(0); setDeliveryCharges(0); setGlobalDiscountType("FLAT");
    setShowModal(true);
  }

  function openEditInvoice(inv: any) {
    if (Number(inv.paid) > 0) return toast.error("Cannot edit an invoice that has payments.");
    setEditingId(inv.id); setIsPostedEdit(inv.status !== "DRAFT");
    setFormCustomerId(inv.customerId || ""); setFormNotes(inv.notes || "");
    setGlobalTax(Number(inv.tax) || 0); setDeliveryCharges(Number(inv.deliveryCharges) || 0);
    setGlobalDiscountVal(Number(inv.discount) || 0); setGlobalDiscountType("FLAT");
    setLines(inv.lines.map((l: any) => ({ id: Math.random().toString(), productId: l.productId, warehouseId: l.warehouseId, batchId: l.batchId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discount: Number(l.discount), tax: Number(l.tax) })));
    setShowModal(true);
  }

  function addLine() { setLines(c => [...c, { id: Math.random().toString(), productId: "", warehouseId: "", batchId: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }]); }
  function removeLine(id: string) { setLines(c => c.filter(l => l.id !== id)); }
  function updateLine(id: string, field: keyof InvoiceLine, val: string | number) { setLines(c => c.map(l => l.id === id ? { ...l, [field]: val } : l)); }

  const totals = useMemo(() => {
    let subtotal = 0; let lineDiscounts = 0; let lineTaxes = 0;
    for (const line of lines) { subtotal += line.quantity * line.unitPrice; lineDiscounts += line.discount; lineTaxes += line.tax; }
    const calcGlobalDiscount = globalDiscountType === "PERCENT" ? (subtotal * globalDiscountVal) / 100 : globalDiscountVal;
    const totalDiscount = lineDiscounts + calcGlobalDiscount;
    const totalTax = lineTaxes + globalTax;
    return { subtotal, totalDiscount, totalTax, deliveryCharges, total: subtotal - totalDiscount + totalTax + deliveryCharges, calcGlobalDiscount };
  }, [lines, globalDiscountVal, globalDiscountType, globalTax, deliveryCharges]);

  async function saveInvoice(status: "DRAFT" | "POSTED") {
    if (salesConfig?.requireCustomer && !formCustomerId) return toast.error("Select a customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    
    setBusy(true);
    try {
      const payload = { 
        id: editingId, 
        customerId: formCustomerId || null, 
        status, 
        discount: totals.calcGlobalDiscount, 
        tax: globalTax, 
        deliveryCharges, 
        notes: formNotes, 
        // Fallbacks if toggles are off
        lines: lines.map(l => ({
          ...l,
          warehouseId: salesConfig?.requireWarehouse ? l.warehouseId : (warehouses[0]?.id || ""),
          batchId: salesConfig?.requireBatchSelection ? l.batchId : (stockBatches.find(b => b.productId === l.productId)?.batchId || "")
        }))
      };
      
      const res = await fetch("/api/sales/invoices", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.ok) { toast.success("Invoice Saved!"); setShowModal(false); loadInvoices(); } else toast.error(j.error);
    } catch (err) { toast.error("System Error"); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 relative z-10">
      <Toaster position="top-right" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
        <div>
          <p className="text-teal-600 dark:text-teal-400 text-xs font-bold tracking-widest uppercase mb-1">Sales & Billing</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices Command Center</h1>
        </div>
        <button onClick={openNewInvoice} className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 px-6 py-4 gap-4">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === tab.id 
                    ? "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 shadow-sm border border-teal-200 dark:border-teal-500/30" 
                    : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex gap-3 items-center w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search invoices..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm outline-none w-full md:w-64 focus:border-teal-500 transition-colors" 
            />
            {activeTab === "draft" && (
              <button onClick={bulkPost} disabled={busy || selectedIds.length === 0} className="bg-slate-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 font-bold px-4 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all whitespace-nowrap shadow-md">
                Post Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="text-center py-20 text-teal-500 font-bold animate-pulse">Synchronizing Ledger...</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5">
                <tr>
                  {activeTab === "draft" && <th className="p-4 w-12 text-center"></th>}
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Balance</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <PackageOpen className="w-12 h-12 text-slate-400 dark:text-zinc-500 opacity-50" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-300">No invoices found</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-500 max-w-sm mx-auto">
                          {activeTab === "draft" ? "You don't have any unposted drafts right now. Create a new invoice to start billing." : "No matching invoices found in this section."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : invoices.map(inv => {
                  const displayStatus = inv.status === "POSTED" ? "UNPAID" : inv.status;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                      {activeTab === "draft" && (
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="accent-teal-500 w-4 h-4 rounded cursor-pointer" />
                        </td>
                      )}
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{inv.invoiceNo}</td>
                      <td className="p-4 font-semibold text-teal-600 dark:text-teal-400">{inv.customer?.name || "Walk-in"}</td>
                      <td className="p-4 text-slate-500 dark:text-zinc-400">{new Date(inv.invoiceDate).toISOString().slice(0, 10)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${
                          displayStatus === "UNPAID" ? "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20" : 
                          displayStatus === "DRAFT" ? "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-white/10" : 
                          "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-900 dark:text-white">{currency} {formatAmount(inv.total)}</td>
                      <td className="p-4 text-right font-bold text-rose-600 dark:text-rose-400">{currency} {formatAmount(inv.balance)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {inv.status !== "DRAFT" && Number(inv.balance) > 0 && (
                             <Link href={`/payments?invoiceId=${inv.id}`} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
                               <CreditCard className="w-3 h-3" /> Pay
                             </Link>
                          )}
                          {Number(inv.paid) === 0 && (
                            <button onClick={() => openEditInvoice(inv)} className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                          )}
                          <Link href={`/sales/invoices/print/${inv.id}`} target="_blank" className="text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
                            <Printer className="w-3 h-3" /> Print
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-zinc-950/50">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingId ? "Edit Invoice" : "Create New Invoice"}</h2>
                {isPostedEdit && <p className="text-xs font-bold text-rose-500 uppercase tracking-wider mt-1">Warning: Editing a posted invoice triggers ledger reversal.</p>}
              </div>
              <button onClick={() => !busy && setShowModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/50 dark:bg-transparent">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-zinc-950/50 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Customer {salesConfig?.requireCustomer && "*"}</label>
                  <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-lg p-3 text-sm outline-none focus:border-teal-500 transition-colors">
                    <option value="">{salesConfig?.allowCashSales ? "Walk-in Cash Customer" : "Select Customer..."}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Invoice #</label>
                    <input type="text" value={editingId ? "Auto-Assigned" : "Generated on Save"} disabled className="w-full border border-slate-200 dark:border-white/5 rounded-lg p-3 text-sm bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-mono shadow-inner cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">System Date</label>
                    <input type="text" value={new Date().toLocaleDateString()} disabled className="w-full border border-slate-200 dark:border-white/5 rounded-lg p-3 text-sm bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 font-mono shadow-inner cursor-not-allowed" />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-950/50">
                <div className="bg-slate-50 dark:bg-white/5 px-5 py-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 dark:text-zinc-300 text-sm uppercase tracking-wider">Invoice Line Items</h3>
                  <button onClick={addLine} className="bg-teal-600 text-white hover:bg-teal-500 px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Row
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-white/10 text-[10px] uppercase text-slate-500 dark:text-zinc-400 font-bold">
                      <tr>
                        <th className="p-3">Product</th>
                        {salesConfig?.requireWarehouse && <th className="p-3">Warehouse</th>}
                        {salesConfig?.requireBatchSelection && <th className="p-3">Batch</th>}
                        <th className="p-3 w-20 text-center">Qty</th>
                        <th className="p-3 w-28 text-right">Price</th>
                        <th className="p-3 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {lines.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="p-3">
                            <select value={l.productId} onChange={e => {
                              const p = products.find(x => x.id === e.target.value);
                              updateLine(l.id, "productId", e.target.value);
                              updateLine(l.id, "unitPrice", p?.salePrice || p?.costPrice || 0);
                            }} className="w-[180px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-2 focus:border-teal-500 outline-none text-xs transition-colors">
                              <option value="">Select...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          {salesConfig?.requireWarehouse && (
                            <td className="p-3">
                              <select value={l.warehouseId} onChange={e => updateLine(l.id, "warehouseId", e.target.value)} className="w-[130px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-2 focus:border-teal-500 outline-none text-xs transition-colors">
                                <option value="">Select...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </select>
                            </td>
                          )}
                          {salesConfig?.requireBatchSelection && (
                            <td className="p-3">
                              <select value={l.batchId} onChange={e => updateLine(l.id, "batchId", e.target.value)} className="w-[130px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-2 focus:border-teal-500 outline-none text-xs transition-colors">
                                <option value="">Select...</option>{stockBatches.filter(b => b.productId === l.productId && (!salesConfig.requireWarehouse || b.warehouseId === l.warehouseId)).map(b => <option key={b.id} value={b.batchId}>{b.batch.batchNumber} ({b.quantity})</option>)}
                              </select>
                            </td>
                          )}
                          <td className="p-3">
                            <input type="number" min="1" value={l.quantity} onChange={e => updateLine(l.id, "quantity", Number(e.target.value))} className="w-[80px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-2 text-center focus:border-teal-500 outline-none text-xs transition-colors" />
                          </td>
                          <td className="p-3">
                            <input type="number" min="0" value={l.unitPrice} onChange={e => updateLine(l.id, "unitPrice", Number(e.target.value))} className="w-[90px] bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-2 text-right focus:border-teal-500 outline-none text-xs transition-colors" />
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => removeLine(l.id)} className="text-slate-400 hover:text-rose-500 transition-colors p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Invoice Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-3 text-sm outline-none focus:border-teal-500 h-36 transition-colors shadow-inner" placeholder="Add terms, details, or optional notes here..."></textarea>
                </div>
                
                <div className="w-full lg:w-80 bg-white dark:bg-zinc-950/50 p-6 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner space-y-4 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400"><span>Subtotal</span><span className="font-bold text-slate-900 dark:text-white">{currency} {formatAmount(totals.subtotal)}</span></div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                    <span className="flex items-center gap-2">Discount 
                      <button onClick={() => setGlobalDiscountType(t => t === "FLAT" ? "PERCENT" : "FLAT")} className="text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 px-2 py-1 rounded font-bold uppercase hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                        {globalDiscountType === "FLAT" ? currency : "%"}
                      </button>
                    </span>
                    <input type="number" min="0" value={globalDiscountVal} onChange={e => setGlobalDiscountVal(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-1.5 text-right text-sm outline-none focus:border-teal-500 transition-colors" />
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                    <span>Tax ({currency})</span>
                    <input type="number" min="0" value={globalTax} onChange={e => setGlobalTax(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-1.5 text-right text-sm outline-none focus:border-teal-500 transition-colors" />
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                    <span>Delivery ({currency})</span>
                    <input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded p-1.5 text-right text-sm outline-none focus:border-teal-500 transition-colors" />
                  </div>
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-200 dark:border-white/10">
                    <span className="font-bold text-slate-900 dark:text-zinc-300 uppercase tracking-widest text-xs">Total</span>
                    <span className="font-black text-2xl text-teal-600 dark:text-teal-400">{currency} {formatAmount(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/50 flex justify-end gap-3">
              <button disabled={busy} onClick={() => saveInvoice("DRAFT")} className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-white rounded-xl font-bold text-sm transition-colors shadow-sm">Save as Draft</button>
              <button disabled={busy} onClick={() => saveInvoice("POSTED")} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-teal-500/20">Finalize & Post to Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
