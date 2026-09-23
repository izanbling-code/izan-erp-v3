"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";
import { Plus, Edit, Printer, CreditCard, FileText, CheckCircle, Globe, PackageOpen } from "lucide-react";

type InvoiceLine = { id: string; productId: string; warehouseId: string; batchId: string; quantity: number; unitPrice: number; discount: number; tax: number; };

export default function UnifiedInvoicesDashboard() {
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
        toast.error(data.error || "Failed to load invoices from database.");
      }
    } catch (err) { 
      toast.error("Network error while connecting to server.");
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
    if (Number(inv.paid) > 0) return toast.error("Cannot edit an invoice that has payments. Remove payments first.");
    setEditingId(inv.id); setIsPostedEdit(inv.status !== "DRAFT");
    setFormCustomerId(inv.customerId); setFormNotes(inv.notes || "");
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
    if (!formCustomerId) return toast.error("Select a customer");
    if (lines.length === 0) return toast.error("Add at least one item");
    
    setBusy(true);
    try {
      const payload = { id: editingId, customerId: formCustomerId, status, discount: totals.calcGlobalDiscount, tax: globalTax, deliveryCharges, notes: formNotes, lines };
      const res = await fetch("/api/sales/invoices", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.ok) { toast.success("Invoice Saved!"); setShowModal(false); loadInvoices(); } else toast.error(j.error);
    } catch (err) { toast.error("System Error"); } finally { setBusy(false); }
  }

  const formatMoney = (val: number) => `₨ ${Number(val).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 p-6 font-sans relative">
      <Toaster position="top-right" />
      
      {/* GRAPHICAL HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-1">Sales & Billing</p>
          <h1 className="text-2xl font-bold text-white">Invoices Command Center</h1>
        </div>
        <button onClick={openNewInvoice} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="bg-[#131C2F] rounded-xl shadow-sm border border-slate-800 overflow-hidden">
        
        {/* TABS & SEARCH */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#0B1121] border-b border-slate-800 px-6 py-4 gap-4">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-bold whitespace-nowrap rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === tab.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
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
              className="bg-[#131C2F] border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2 text-sm outline-none w-full md:w-64 focus:border-blue-500 transition" 
            />
            {activeTab === "draft" && (
              <button 
                onClick={bulkPost} 
                disabled={busy || selectedIds.length === 0} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition whitespace-nowrap"
              >
                Post Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="text-center py-20 text-blue-400 font-bold animate-pulse">Synchronizing Ledger...</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap !bg-[#131C2F]">
              <thead className="!bg-[#0B1121] !text-slate-400 text-[11px] uppercase tracking-wider">
                <tr>
                  {activeTab === "draft" && <th className="p-4 w-12 text-center !border-b !border-slate-800"></th>}
                  <th className="p-4 font-semibold !border-b !border-slate-800">Invoice #</th>
                  <th className="p-4 font-semibold !border-b !border-slate-800">Customer</th>
                  <th className="p-4 font-semibold !border-b !border-slate-800">Date</th>
                  <th className="p-4 font-semibold text-center !border-b !border-slate-800">Status</th>
                  <th className="p-4 font-semibold text-right !border-b !border-slate-800">Total</th>
                  <th className="p-4 font-semibold text-right !border-b !border-slate-800">Balance</th>
                  <th className="p-4 font-semibold text-center !border-b !border-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody className="!divide-y !divide-slate-800/50">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <PackageOpen className="w-12 h-12 text-slate-500 opacity-50" />
                        <h3 className="text-lg font-bold text-slate-400">No invoices found</h3>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                          {activeTab === "draft" ? "You don't have any unposted drafts right now. Create a new invoice to start billing." : "No matching invoices found in this section."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : invoices.map(inv => {
                  const displayStatus = inv.status === "POSTED" ? "UNPAID" : inv.status;
                  return (
                    <tr key={inv.id} className="!bg-[#131C2F] hover:!bg-white transition-colors group">
                      {activeTab === "draft" && (
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="accent-blue-500 w-4 h-4 rounded cursor-pointer" />
                        </td>
                      )}
                      <td className="p-4 font-bold !text-white group-hover:!text-black transition-colors">{inv.invoiceNo}</td>
                      <td className="p-4 font-semibold !text-blue-400 group-hover:!text-black transition-colors">{inv.customer?.name || "Walk-in"}</td>
                      <td className="p-4 !text-slate-400 group-hover:!text-black transition-colors">{new Date(inv.invoiceDate).toISOString().slice(0, 10)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${
                          displayStatus === "UNPAID" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
                          displayStatus === "DRAFT" ? "bg-slate-500/10 text-slate-400 border border-slate-500/20" : 
                          "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold !text-slate-200 group-hover:!text-black transition-colors">{formatMoney(inv.total)}</td>
                      <td className="p-4 text-right font-bold !text-rose-400 group-hover:!text-red-600 transition-colors">{formatMoney(inv.balance)}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          
                          {/* PAY BUTTON DIRECTS TO PAYMENTS */}
                          {inv.status !== "DRAFT" && Number(inv.balance) > 0 && (
                             <Link href={`/payments?invoiceId=${inv.id}`} className="!text-emerald-400 group-hover:!text-emerald-600 hover:!text-emerald-800 flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
                               <CreditCard className="w-3 h-3" /> Pay
                             </Link>
                          )}
                          
                          {Number(inv.paid) === 0 && (
                            <button onClick={() => openEditInvoice(inv)} className="!text-blue-400 group-hover:!text-blue-600 hover:!text-blue-800 flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                          )}
                          
                          <Link href={`/sales/invoices/print/${inv.id}`} target="_blank" className="!text-slate-300 group-hover:!text-slate-600 hover:!text-black flex items-center gap-1 text-xs font-bold uppercase tracking-wider transition-colors">
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

      {/* SINGLE-PAGE INVOICE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-[#131C2F] border-l border-slate-800 w-full max-w-5xl h-full shadow-2xl flex flex-col animate-fade-in-right">
            
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#0B1121]">
              <div>
                <h2 className="text-xl font-bold text-white">{editingId ? "Edit Invoice" : "Create New Invoice"}</h2>
                {isPostedEdit && <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mt-1">Warning: Editing a posted invoice will trigger an automatic ledger reversal.</p>}
              </div>
              <button onClick={() => !busy && setShowModal(false)} className="text-slate-500 hover:text-white text-3xl transition">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar text-slate-200">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0B1121] p-6 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer</label>
                  <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="w-full !bg-white !text-black border border-slate-300 rounded-lg p-3 text-sm outline-none focus:border-blue-500 transition appearance-none">
                    <option value="">Select Customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Invoice #</label>
                    <input type="text" value={editingId ? "Auto-Assigned" : "Generated on Save"} disabled className="w-full border border-slate-300 rounded-lg p-3 text-sm !bg-gray-100 !text-black font-mono shadow-inner" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System Date</label>
                    <input type="text" value={new Date().toLocaleDateString()} disabled className="w-full border border-slate-300 rounded-lg p-3 text-sm !bg-gray-100 !text-black shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm bg-[#0B1121]">
                <div className="bg-slate-800/30 px-5 py-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider">Invoice Line Items</h3>
                  <button onClick={addLine} className="bg-blue-600 text-white hover:bg-blue-500 px-4 py-1.5 text-xs font-bold rounded-lg transition">+ Add Row</button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="!bg-white border-b border-slate-300 text-[10px] uppercase !text-black font-bold">
                      <tr><th className="p-3">Product</th><th className="p-3">Warehouse</th><th className="p-3">Batch</th><th className="p-3 w-20 text-center">Qty</th><th className="p-3 w-28 text-right">Price</th><th className="p-3 w-12 text-center"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {lines.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/20 transition">
                          <td className="p-3">
                            <select value={l.productId} onChange={e => {
                              const p = products.find(x => x.id === e.target.value);
                              updateLine(l.id, "productId", e.target.value);
                              updateLine(l.id, "unitPrice", p?.salePrice || p?.costPrice || 0);
                            }} className="w-full !bg-white !text-black border border-slate-300 rounded p-2 focus:border-blue-500 outline-none text-xs">
                              <option value="">Select...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td className="p-3">
                            <select value={l.warehouseId} onChange={e => updateLine(l.id, "warehouseId", e.target.value)} className="w-full !bg-white !text-black border border-slate-300 rounded p-2 focus:border-blue-500 outline-none text-xs">
                              <option value="">Select...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                          <td className="p-3">
                            <select value={l.batchId} onChange={e => updateLine(l.id, "batchId", e.target.value)} className="w-full !bg-white !text-black border border-slate-300 rounded p-2 focus:border-blue-500 outline-none text-xs">
                              <option value="">Select...</option>{stockBatches.filter(b => b.productId === l.productId && b.warehouseId === l.warehouseId).map(b => <option key={b.id} value={b.batchId}>{b.batch.batchNumber} (Avail: {b.quantity})</option>)}
                            </select>
                          </td>
                          <td className="p-3">
                            <input type="number" min="1" value={l.quantity} onChange={e => updateLine(l.id, "quantity", Number(e.target.value))} className="w-full !bg-white !text-black border border-slate-300 rounded p-2 text-center focus:border-blue-500 outline-none text-xs" />
                          </td>
                          <td className="p-3">
                            <input type="number" min="0" value={l.unitPrice} onChange={e => updateLine(l.id, "unitPrice", Number(e.target.value))} className="w-full !bg-white !text-black border border-slate-300 rounded p-2 text-right focus:border-blue-500 outline-none text-xs" />
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => removeLine(l.id)} className="text-red-400 hover:text-red-300 font-bold p-1 transition">&times;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Invoice Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full !bg-white !text-black border border-slate-300 rounded-xl p-3 text-sm outline-none focus:border-blue-500 h-36" placeholder="Add terms, details, or optional notes here..."></textarea>
                </div>
                
                <div className="w-full lg:w-80 bg-[#0B1121] p-6 rounded-xl border border-slate-800 space-y-4 text-sm">
                  <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-bold text-white">{formatMoney(totals.subtotal)}</span></div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="flex items-center gap-2">Discount 
                      <button onClick={() => setGlobalDiscountType(t => t === "FLAT" ? "PERCENT" : "FLAT")} className="text-[10px] bg-[#131C2F] border border-slate-700 px-2 py-1 rounded font-bold uppercase hover:bg-slate-800 transition">
                        {globalDiscountType === "FLAT" ? "₨" : "%"}
                      </button>
                    </span>
                    <input type="number" min="0" value={globalDiscountVal} onChange={e => setGlobalDiscountVal(Number(e.target.value))} className="w-24 !bg-white !text-black border border-slate-300 rounded p-1.5 text-right text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Global Tax (₨)</span>
                    <input type="number" min="0" value={globalTax} onChange={e => setGlobalTax(Number(e.target.value))} className="w-24 !bg-white !text-black border border-slate-300 rounded p-1.5 text-right text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Delivery (₨)</span>
                    <input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(Number(e.target.value))} className="w-24 !bg-white !text-black border border-slate-300 rounded p-1.5 text-right text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-800">
                    <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">Total</span>
                    <span className="font-black text-2xl text-emerald-400">{formatMoney(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-slate-800 bg-[#0B1121] flex justify-end gap-3">
              <button disabled={busy} onClick={() => saveInvoice("DRAFT")} className="px-6 py-2.5 bg-[#131C2F] border border-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold text-sm transition">Save as Draft</button>
              <button disabled={busy} onClick={() => saveInvoice("POSTED")} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition shadow-lg shadow-blue-500/20">Finalize & Post to Ledger</button>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.8); }
      `}} />
    </div>
  );
}
