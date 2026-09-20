"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";

type InvoiceLine = { id: string; productId: string; warehouseId: string; batchId: string; quantity: number; unitPrice: number; discount: number; tax: number; };

export default function UnifiedInvoicesDashboard() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"unposted" | "posted">("unposted");
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
    <div className="max-w-7xl mx-auto p-6 space-y-6 relative">
      <Toaster position="top-right" />
      
      {/* GRAPHICAL HEADER */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-2xl p-8 text-white shadow-lg flex justify-between items-center">
        <div>
          <p className="text-indigo-200 text-sm font-bold tracking-widest uppercase mb-1">Sales & Billing</p>
          <h1 className="text-3xl font-black">Invoices Command Center</h1>
        </div>
        <button onClick={openNewInvoice} className="bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold shadow-md transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
          New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex justify-between items-center bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex gap-2 bg-white p-1 border rounded-lg shadow-sm">
            <button onClick={() => setActiveTab("unposted")} className={`px-4 py-1.5 rounded font-bold text-sm transition ${activeTab === "unposted" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}>Drafts</button>
            <button onClick={() => setActiveTab("posted")} className={`px-4 py-1.5 rounded font-bold text-sm transition ${activeTab === "posted" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-100"}`}>Posted & Paid</button>
          </div>
          <div className="flex gap-3 items-center">
            <input type="text" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none w-64 shadow-inner focus:ring-2 focus:ring-indigo-500 transition" />
            {activeTab === "unposted" && <button onClick={bulkPost} disabled={busy || selectedIds.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition shadow-sm">Post Selected ({selectedIds.length})</button>}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? <div className="text-center py-20 text-indigo-400 font-bold animate-pulse">Synchronizing Ledger...</div> : (
            <table className="erp-data-table">
              <thead className="bg-white border-b"><tr className="text-[11px] uppercase text-gray-500 font-extrabold tracking-wider">
                {activeTab === "unposted" && <th className="py-4 px-5 w-10"></th>}
                <th className="py-4 px-5">Invoice #</th><th className="py-4 px-5">Customer</th><th className="py-4 px-5">Date</th><th className="py-4 px-5">Status</th><th className="py-4 px-5 text-right">Total</th><th className="py-4 px-5 text-right">Balance</th><th className="py-4 px-5 text-center">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
                          <svg className="w-12 h-12 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <h3 className="text-xl font-extrabold text-gray-900">No invoices found</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                          {activeTab === "unposted" ? "You don't have any unposted drafts right now. Create a new invoice to start billing." : "You don't have any posted or paid invoices matching this criteria."}
                        </p>
                        {activeTab === "unposted" && (
                          <button onClick={openNewInvoice} className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition shadow-sm">
                            Create First Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : invoices.map(inv => {
                  const displayStatus = inv.status === "POSTED" ? "UNPAID" : inv.status;
                  return (
                    <tr key={inv.id} className="hover:bg-indigo-50/30 transition">
                      {activeTab === "unposted" && <td className="py-3 px-5"><input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleSelect(inv.id)} className="w-4 h-4 cursor-pointer rounded text-indigo-600 focus:ring-indigo-500" /></td>}
                      <td className="py-3 px-5 font-bold text-gray-900">{inv.invoiceNo}</td>
                      <td className="py-3 px-5 font-semibold text-indigo-700">{inv.customer?.name || "Walk-in"}</td>
                      <td className="py-3 px-5 text-gray-600">{new Date(inv.invoiceDate).toISOString().slice(0, 10)}</td>
                      <td className="py-3 px-5"><span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${displayStatus === "UNPAID" ? "bg-amber-100 text-amber-800 border border-amber-200" : displayStatus === "DRAFT" ? "bg-gray-100 text-gray-600 border border-gray-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>{displayStatus}</span></td>
                      <td className="py-3 px-5 text-right font-black text-gray-900">{formatMoney(inv.total)}</td>
                      <td className="py-3 px-5 text-right font-black text-rose-600">{formatMoney(inv.balance)}</td>
                      <td className="py-3 px-5 text-center space-x-2">
                        {Number(inv.paid) === 0 && <button onClick={() => openEditInvoice(inv)} className="text-xs font-bold bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-3 py-1.5 rounded transition shadow-sm">Edit</button>}
                        <Link href={`/sales/invoices/print/${inv.id}`} target="_blank" className="inline-block text-xs font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded transition shadow-sm">🖨️ Print</Link>
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
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-fade-in-right">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-black text-gray-900">{editingId ? "Edit Invoice" : "Create New Invoice"}</h2>
                {isPostedEdit && <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mt-1">Warning: Editing a posted invoice will trigger an automatic ledger reversal.</p>}
              </div>
              <button onClick={() => !busy && setShowModal(false)} className="text-gray-400 hover:text-gray-800 font-bold text-3xl">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2">Customer</label>
                  <select value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)} className="w-full border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition">
                    <option value="">Select Customer...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2">Invoice #</label>
                    <input type="text" value={editingId ? "Auto-Assigned" : "Generated on Save"} disabled className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-100 text-gray-500 font-mono shadow-inner" />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2">System Date</label>
                    <input type="text" value={new Date().toLocaleDateString()} disabled className="w-full border border-gray-200 rounded-lg p-3 text-sm bg-gray-100 text-gray-500 shadow-inner" />
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-indigo-50/50 px-5 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="font-extrabold text-indigo-900 text-sm uppercase tracking-wider">Invoice Line Items</h3>
                  <button onClick={addLine} className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm transition">+ Add Row</button>
                </div>
                <table className="erp-data-table">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase text-gray-500 font-bold">
                    <tr><th className="p-3">Product</th><th className="p-3">Warehouse</th><th className="p-3">Batch</th><th className="p-3 w-20 text-center">Qty</th><th className="p-3 w-24 text-right">Price</th><th className="p-3 w-12 text-center"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-50 transition">
                        <td className="p-3"><select value={l.productId} onChange={e => {
                          const p = products.find(x => x.id === e.target.value);
                          updateLine(l.id, "productId", e.target.value);
                          updateLine(l.id, "unitPrice", p?.salePrice || p?.costPrice || 0);
                        }} className="w-full border border-gray-200 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="">Select...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                        <td className="p-3"><select value={l.warehouseId} onChange={e => updateLine(l.id, "warehouseId", e.target.value)} className="w-full border border-gray-200 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="">Select...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></td>
                        <td className="p-3"><select value={l.batchId} onChange={e => updateLine(l.id, "batchId", e.target.value)} className="w-full border border-gray-200 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="">Select...</option>{stockBatches.filter(b => b.productId === l.productId && b.warehouseId === l.warehouseId).map(b => <option key={b.id} value={b.batchId}>{b.batch.batchNumber} (Avail: {b.quantity})</option>)}</select></td>
                        <td className="p-3"><input type="number" min="1" value={l.quantity} onChange={e => updateLine(l.id, "quantity", Number(e.target.value))} className="w-full border border-gray-200 rounded p-2 text-center focus:ring-indigo-500 focus:border-indigo-500" /></td>
                        <td className="p-3"><input type="number" min="0" value={l.unitPrice} onChange={e => updateLine(l.id, "unitPrice", Number(e.target.value))} className="w-full border border-gray-200 rounded p-2 text-right focus:ring-indigo-500 focus:border-indigo-500" /></td>
                        <td className="p-3 text-center"><button onClick={() => removeLine(l.id)} className="text-rose-500 font-black hover:bg-rose-100 p-2 rounded transition">&times;</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-start gap-8">
                <div className="flex-1">
                  <label className="block text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2">Invoice Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-36 shadow-sm" placeholder="Add terms, details, or optional notes here..."></textarea>
                </div>
                <div className="w-80 bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-bold text-gray-900">{formatMoney(totals.subtotal)}</span></div>
                  <div className="flex justify-between items-center text-gray-600">
                    <span className="flex items-center gap-2">Discount <button onClick={() => setGlobalDiscountType(t => t === "FLAT" ? "PERCENT" : "FLAT")} className="text-[10px] bg-white border border-gray-300 shadow-sm px-2 py-1 rounded font-bold uppercase hover:bg-gray-100 transition">{globalDiscountType === "FLAT" ? "₨" : "%"}</button></span>
                    <input type="number" min="0" value={globalDiscountVal} onChange={e => setGlobalDiscountVal(Number(e.target.value))} className="w-24 border border-gray-300 rounded p-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex justify-between items-center text-gray-600"><span>Global Tax (₨)</span><input type="number" min="0" value={globalTax} onChange={e => setGlobalTax(Number(e.target.value))} className="w-24 border border-gray-300 rounded p-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                  <div className="flex justify-between items-center text-gray-600"><span>Delivery (₨)</span><input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(Number(e.target.value))} className="w-24 border border-gray-300 rounded p-1.5 text-right text-sm outline-none focus:ring-1 focus:ring-indigo-500" /></div>
                  <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-gray-300"><span className="font-black text-gray-900 uppercase tracking-widest text-xs">Total</span><span className="font-black text-2xl text-indigo-700">{formatMoney(totals.total)}</span></div>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t bg-gray-50 flex justify-end gap-3 shadow-inner">
              <button disabled={busy} onClick={() => saveInvoice("DRAFT")} className="px-6 py-2.5 border border-gray-300 bg-white hover:bg-gray-100 rounded-lg font-bold text-gray-700 text-sm transition shadow-sm">Save as Draft</button>
              <button disabled={busy} onClick={() => saveInvoice("POSTED")} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition transform hover:-translate-y-0.5">Finalize & Post to Ledger</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}