"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { 
  FileText, Plus, Search, Printer, Loader2, Truck, Banknote, 
  ShoppingBag, X, Trash2, Save, CheckCircle2, Globe, AlertCircle, 
  ChevronDown, Eye, Edit
} from "lucide-react";

// ==========================================
// 0. CUSTOM SEARCHABLE SELECT COMPONENT
// ==========================================
function ProductSelect({ products, value, onChange }: { products: any[], value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );
  const selectedProduct = products.find(p => p.id === value);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white cursor-pointer flex justify-between items-center focus:border-teal-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate pr-2">
          {selectedProduct ? `${selectedProduct.sku} - ${selectedProduct.name}` : (products.length === 0 ? "No products found" : "Select Product...")}
        </span>
        <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-64">
          <div className="p-2 border-b border-white/10 bg-zinc-900 sticky top-0">
             <input type="text" autoFocus placeholder="Search SKU or Name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-teal-500" />
          </div>
          <div className="overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="p-3 text-xs text-zinc-500 text-center">No products match "{search}"</div>
            ) : (
              filteredProducts.map(p => (
                <div key={p.id} onClick={() => { onChange(p.id); setIsOpen(false); setSearch(""); }} className="px-3 py-2 text-xs text-zinc-300 hover:bg-teal-500/20 hover:text-white cursor-pointer truncate border-b border-white/5 last:border-0">
                  {p.sku} - {p.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// 1. MAIN COMMAND CENTRE COMPONENT
// ==========================================
export default function InvoiceCommandCentre() {
  const { formatAmount, currency } = useERPConfig("general");
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"POSTED" | "DRAFT" | "ALL">("POSTED");

  async function loadInvoices() {
    try {
      setLoading(true);
      const { data: company, error: compErr } = await supabase.from("Company").select("id").limit(1).single();
      
      if (compErr || !company) return;

      const { data, error } = await supabase
        .from("SalesInvoice")
        .select(`*, customer:Customer(name, phone), lines:SalesInvoiceLine(*)`)
        .eq("companyId", company.id)
        .order("createdAt", { ascending: false });

      if (data) setInvoices(data);
      if (error) console.error("Invoice fetch error:", error);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInvoices(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this invoice? This cannot be undone.")) return;
    try {
      await supabase.from("SalesInvoiceLine").delete().eq("invoiceId", id);
      await supabase.from("SalesInvoice").delete().eq("id", id);
      await loadInvoices();
    } catch (err) {
      alert("Failed to delete invoice.");
    }
  };

  const handlePost = async (inv: any) => {
    if (!window.confirm("Finalize this draft invoice?")) return;
    try {
      await supabase.from("SalesInvoice").update({ status: "POSTED", updatedAt: new Date().toISOString() }).eq("id", inv.id);
      await loadInvoices();
    } catch (err) {
      alert("Failed to post invoice.");
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = 
        inv.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customer?.name?.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;

      const isWebOrder = inv.notes?.toLowerCase().includes("web") || inv.referenceType === "WEB";
      const isDraft = inv.status === "DRAFT" || inv.status === "VOID";
      
      if (activeTab === "POSTED") return inv.status === "POSTED" || inv.status === "RECONCILED";
      if (activeTab === "DRAFT") return isDraft || isWebOrder;
      return true; 
    });
  }, [invoices, search, activeTab]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let pendingAmount = 0;
    let webOrders = 0;
    let drafts = 0;
    
    invoices.forEach(inv => {
      const isWeb = inv.notes?.toLowerCase().includes("web") || inv.referenceType === "WEB";
      if (isWeb) webOrders++;
      if (inv.status === "DRAFT") drafts++;
      
      if (inv.status !== "DRAFT") {
        totalRevenue += Number(inv.total) || 0;
        pendingAmount += Number(inv.balance) || 0;
      }
    });
    return { totalRevenue, pendingAmount, count: invoices.length, webOrders, drafts };
  }, [invoices]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-500" /> Invoice Command Centre
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Manage manual sales, web orders, and receivables.</p>
        </div>
        <button onClick={() => { setEditingInvoice(null); setShowModal(true); }} className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-teal-500/20">
          <Plus className="w-4 h-4" /> Create New Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: stats.count, color: "text-white" },
          { label: "Drafts / Web Orders", value: stats.drafts + stats.webOrders, color: "text-amber-400" },
          { label: "Total Revenue (Posted)", value: `${currency} ${formatAmount(stats.totalRevenue)}`, color: "text-emerald-400" },
          { label: "Pending Receivables", value: `${currency} ${formatAmount(stats.pendingAmount)}`, color: "text-rose-400" },
        ].map((kpi, i) => (
          <div key={i} className="bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{kpi.label}</div>
            <div className={`text-xl font-black font-mono ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Main Table Panel */}
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        
        {/* Navigation & Search */}
        <div className="p-4 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/20">
          
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/10">
            <button onClick={() => setActiveTab("POSTED")} className={`px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeTab === "POSTED" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>Posted Invoices</button>
            <button onClick={() => setActiveTab("DRAFT")} className={`px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeTab === "DRAFT" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>Drafts & Web Orders</button>
            <button onClick={() => setActiveTab("ALL")} className={`px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${activeTab === "ALL" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>All</button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
            </div>
            <button onClick={loadInvoices} disabled={loading} className="p-2 text-zinc-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
              <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-4" /> Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <FileText className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No invoices found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-950/50 border-b border-white/5 text-xs text-zinc-500 uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Invoice #</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Balance</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredInvoices.map((inv) => {
                  const isWebOrder = inv.notes?.toLowerCase().includes("web") || inv.referenceType === "WEB";
                  return (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-white">{inv.invoiceNo}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-white">{inv.customer?.name || "Guest"}</div>
                      </td>
                      <td className="px-6 py-4">
                        {isWebOrder ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"><Globe className="w-3 h-3" /> Web Order</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/5">Manual</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{new Date(inv.invoiceDate).toISOString().slice(0, 10)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-white text-right">{currency} {formatAmount(inv.total)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-rose-400 text-right">{currency} {formatAmount(inv.balance)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${inv.status === "POSTED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : inv.status === "RECONCILED" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>{inv.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          
                          {/* View Button */}
                          <button onClick={() => setViewingInvoice(inv)} className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          
                          {/* Edit Button (Only Drafts) */}
                          {inv.status === "DRAFT" && (
                            <button onClick={() => { setEditingInvoice(inv); setShowModal(true); }} className="p-1.5 text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 rounded-md transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                          )}

                          {/* Post Button (Only Drafts) */}
                          {inv.status === "DRAFT" && (
                            <button onClick={() => handlePost(inv)} className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors" title="Finalize"><CheckCircle2 className="w-4 h-4" /></button>
                          )}

                          {/* Print Button */}
                          <Link href={`/sales/invoices/print/${inv.id}`} className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="Print"><Printer className="w-4 h-4" /></Link>
                          
                          {/* Delete Button */}
                          <button onClick={() => handleDelete(inv.id)} className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT INVOICE MODAL */}
      {showModal && (
        <CreateInvoiceModal 
          initialData={editingInvoice}
          onClose={() => { setShowModal(false); setEditingInvoice(null); }} 
          onSuccess={() => { setShowModal(false); setEditingInvoice(null); loadInvoices(); }} 
        />
      )}

      {/* VIEW INVOICE MODAL (Simplified) */}
      {viewingInvoice && (
        <div className="fixed inset-y-0 right-0 left-[250px] z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Invoice {viewingInvoice.invoiceNo}</h2>
              <button onClick={() => setViewingInvoice(null)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-2 text-sm text-zinc-300">
              <p><strong>Customer:</strong> {viewingInvoice.customer?.name}</p>
              <p><strong>Date:</strong> {new Date(viewingInvoice.invoiceDate).toLocaleDateString()}</p>
              <p><strong>Status:</strong> {viewingInvoice.status}</p>
              <p><strong>Total:</strong> {currency} {formatAmount(viewingInvoice.total)}</p>
              <hr className="border-white/10 my-4" />
              <h3 className="font-bold text-white mb-2">Line Items</h3>
              {viewingInvoice.lines?.map((l: any, i: number) => (
                 <div key={i} className="flex justify-between border-b border-white/5 py-1">
                   <span>{l.description} (x{l.quantity})</span>
                   <span>{currency} {formatAmount(l.total)}</span>
                 </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


// ==========================================
// 2. CREATE / EDIT INVOICE MODAL COMPONENT
// ==========================================
function CreateInvoiceModal({ onClose, onSuccess, initialData }: { onClose: () => void, onSuccess: () => void, initialData?: any }) {
  const { formatAmount, currency } = useERPConfig("general");
  const { config: accounting } = useERPConfig("accounting");
  const { config: sales } = useERPConfig("sales");
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [depositAccounts, setDepositAccounts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [saving, setSaving] = useState(false);

  // Form State - Initialized with initialData if editing
  const [customerId, setCustomerId] = useState(initialData?.customerId || "");
  const [orderType, setOrderType] = useState<"COD" | "NON_COD" | "CASH">(
    initialData?.notes?.includes("COD") ? "COD" : initialData?.notes?.includes("CASH") ? "CASH" : "NON_COD"
  );
  const [courierId, setCourierId] = useState(initialData?.courierId || sales?.defaultCourierPartner || "");
  const [depositAccountId, setDepositAccountId] = useState(initialData?.depositAccountId || accounting?.defaultCashAccount || "");
  const [notes, setNotes] = useState(initialData?.notes?.replace(/OrderType:.*/, "") || "");
  const [deliveryCharges, setDeliveryCharges] = useState(initialData?.deliveryCharges || 0);
  const [discount, setDiscount] = useState(initialData?.discount || 0);
  
  const [lines, setLines] = useState<any[]>(
    initialData?.lines?.map((l: any) => ({
      productId: l.productId,
      batchId: l.batchId || "",
      warehouseId: l.warehouseId || "",
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPercent: 0, // If editing, we default to 0% since we don't have the original percentage
      total: l.total,
      discountAmount: l.discount
    })) || [{ productId: "", batchId: "", warehouseId: "", quantity: 1, unitPrice: 0, discountPercent: 0, total: 0, discountAmount: 0 }]
  );

  // Fetch initial dropdown data
  useEffect(() => {
    async function loadDropdowns() {
      try {
        setLoadingData(true);
        setFetchError("");

        const { data: company, error: compErr } = await supabase.from("Company").select("id").limit(1).single();
        
        if (compErr || !company) {
          setFetchError("Could not find Company profile in DB.");
          setLoadingData(false);
          return;
        }

        const companyId = company.id;

        const [custRes, prodRes, courRes, accRes, whRes, batchRes] = await Promise.all([
          supabase.from("Customer").select("id, name").eq("companyId", companyId).order("name"),
          supabase.from("Product").select("id, name, salePrice, sku").eq("companyId", companyId).eq("isActive", true),
          supabase.from("Courier").select("id, name").eq("companyId", companyId).order("name"),
          supabase.from("Account").select("id, name, code").eq("companyId", companyId).eq("type", "ASSET").order("code"),
          supabase.from("Warehouse").select("id, name").eq("companyId", companyId),
          supabase.from("InventoryBatch").select("id, batchNumber, productId").eq("companyId", companyId)
        ]);

        if (custRes.data) setCustomers(custRes.data);
        if (prodRes.data) setProducts(prodRes.data);
        if (courRes.data) setCouriers(courRes.data);
        if (accRes.data) setDepositAccounts(accRes.data);
        if (whRes.data) setWarehouses(whRes.data);
        if (batchRes.data) setBatches(batchRes.data);

      } catch (err: any) {
        console.error("❌ Unexpected error:", err);
        setFetchError(err.message);
      } finally {
        setLoadingData(false);
      }
    }
    loadDropdowns();
  }, []);

  // Calculations
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.quantity) * Number(line.unitPrice)) - Number(line.discountAmount), 0);
  const calculatedTax = orderType === "COD" ? (subtotal * (Number(sales?.defaultTaxRate) || 0)) / 100 : 0;
  const total = subtotal - Number(discount) + Number(calculatedTax) + Number(deliveryCharges);

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    
    if (field === "productId") {
      const prod = products.find(p => p.id === value);
      if (prod) newLines[index].unitPrice = Number(prod.salePrice) || 0;
      newLines[index].batchId = "";
    }
    
    const qty = Number(newLines[index].quantity) || 0;
    const price = Number(newLines[index].unitPrice) || 0;
    const discPct = Number(newLines[index].discountPercent) || 0;
    const gross = qty * price;
    const discAmount = gross * (discPct / 100);
    
    newLines[index].discountAmount = discAmount;
    newLines[index].total = gross - discAmount;
    
    setLines(newLines);
  };

  const handleSubmit = async (status: "DRAFT" | "POSTED") => {
    if (!customerId) return alert("Please select a customer.");
    if (lines.some(l => !l.productId || l.quantity <= 0)) return alert("Please fill all line items properly.");
    
    try {
      setSaving(true);
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      const now = new Date().toISOString();
      const invoiceId = initialData?.id || crypto.randomUUID();
      
      const prefix = sales?.invoicePrefix || "INV";
      const invoiceNo = initialData?.invoiceNo || `${prefix}-${Date.now().toString().slice(-6)}`;

      const payload = {
        companyId: company?.id,
        customerId,
        invoiceNo,
        invoiceDate: now.split("T")[0],
        status,
        subtotal,
        discount: sales?.allowDiscounts ? discount : 0,
        tax: calculatedTax,
        deliveryCharges,
        total,
        paid: 0,
        balance: total,
        notes: notes ? `${notes}\nOrderType: ${orderType}` : `OrderType: ${orderType}`,
        courierId: orderType === "COD" ? courierId : null,
        updatedAt: now
      };

      if (initialData) {
        // UPDATE MODE
        const { error: invErr } = await supabase.from("SalesInvoice").update(payload).eq("id", invoiceId);
        if (invErr) throw invErr;
        
        // Delete old lines and insert new ones
        await supabase.from("SalesInvoiceLine").delete().eq("invoiceId", invoiceId);
      } else {
        // INSERT MODE
        const { error: invErr } = await supabase.from("SalesInvoice").insert({ id: invoiceId, ...payload, createdAt: now });
        if (invErr) throw invErr;
      }

      // Insert Lines
      const invoiceLines = lines.map(l => ({
        id: crypto.randomUUID(),
        invoiceId,
        productId: l.productId,
        description: products.find(p => p.id === l.productId)?.name || "Item",
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discount: Number(l.discountAmount) || 0,
        total: Number(l.total),
        batchId: l.batchId || null,
        warehouseId: l.warehouseId || null,
        createdAt: now,
        updatedAt: now
      }));

      const { error: lineErr } = await supabase.from("SalesInvoiceLine").insert(invoiceLines);
      if (lineErr) throw lineErr;

      onSuccess();
    } catch (err: any) {
      alert("Failed to save invoice: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) return <div className="fixed inset-y-0 right-0 left-[250px] z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"><Loader2 className="w-8 h-8 text-teal-500 animate-spin" /></div>;

  return (
    <div className="fixed inset-y-0 right-0 left-[250px] z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
          <h2 className="text-xl font-bold text-white">{initialData ? "Edit Invoice" : "Create New Invoice"}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          
          {fetchError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">{fetchError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 p-5 rounded-xl border border-white/5">
            
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Customer</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none">
                <option value="">{customers.length === 0 ? "No customers found (Check RLS)" : "Select Customer..."}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Order Channel</label>
              <div className="flex bg-zinc-900 p-1 rounded-lg border border-white/10">
                <button type="button" onClick={() => setOrderType("NON_COD")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-colors ${orderType === "NON_COD" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}><ShoppingBag className="w-4 h-4" /> Standard</button>
                <button type="button" onClick={() => setOrderType("COD")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-colors ${orderType === "COD" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}><Truck className="w-4 h-4" /> COD</button>
                <button type="button" onClick={() => setOrderType("CASH")} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-md transition-colors ${orderType === "CASH" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}><Banknote className="w-4 h-4" /> Cash</button>
              </div>
            </div>

            {orderType === "COD" && (
              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2">
                <label className="block text-[11px] font-bold text-teal-400 uppercase tracking-widest mb-2">Select Courier</label>
                <select value={courierId} onChange={e => setCourierId(e.target.value)} className="w-full bg-zinc-900 border border-teal-500/30 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none">
                  <option value="">Choose a courier...</option>
                  {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {orderType === "CASH" && (
              <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2">
                <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-2">Deposit Account</label>
                <select value={depositAccountId} onChange={e => setDepositAccountId(e.target.value)} className="w-full bg-zinc-900 border border-emerald-500/30 rounded-lg px-4 py-2.5 text-sm text-white focus:border-emerald-500 outline-none">
                  <option value="">Select Account...</option>
                  {depositAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="border border-white/10 rounded-xl overflow-visible">
            <div className="flex items-center bg-zinc-950 p-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/10 gap-2 rounded-t-xl">
              <div className="flex-1 min-w-[150px]">Product Name</div>
              {sales?.requireWarehouse && <div className="w-32">Warehouse</div>}
              {sales?.requireBatch && <div className="w-32">Batch</div>}
              <div className="w-16 text-center">Qty</div>
              <div className="w-24 text-right">Price</div>
              <div className="w-24 text-right">Disc %</div>
              <div className="w-24 text-right">Total</div>
              <div className="w-8"></div>
            </div>

            {lines.map((line, idx) => {
               const filteredBatches = batches.filter(b => b.productId === line.productId);
               return (
                <div key={idx} className="flex items-center gap-2 p-2 border-b border-white/5 bg-black/20">
                  
                  <div className="flex-1 min-w-[150px]">
                    <ProductSelect products={products} value={line.productId} onChange={(val) => updateLine(idx, "productId", val)} />
                  </div>

                  {sales?.requireWarehouse && (
                    <div className="w-32">
                      <select value={line.warehouseId} onChange={e => updateLine(idx, "warehouseId", e.target.value)} className={`w-full bg-zinc-900 border rounded-lg px-2 py-1.5 text-xs text-white outline-none ${!line.warehouseId ? 'border-rose-500/50' : 'border-white/10'}`}>
                        <option value="">Select...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  )}

                  {sales?.requireBatch && (
                    <div className="w-32">
                      <select value={line.batchId} onChange={e => updateLine(idx, "batchId", e.target.value)} className={`w-full bg-zinc-900 border rounded-lg px-2 py-1.5 text-xs text-white outline-none ${!line.batchId ? 'border-rose-500/50' : 'border-white/10'}`}>
                        <option value="">{line.productId && filteredBatches.length === 0 ? "No batches" : "Select..."}</option>
                        {filteredBatches.map(b => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="w-16">
                    <input type="number" min="1" value={line.quantity} onChange={e => updateLine(idx, "quantity", e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center outline-none focus:border-teal-500" />
                  </div>

                  <div className="w-24">
                    <input type="number" min="0" value={line.unitPrice} onChange={e => updateLine(idx, "unitPrice", e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-right outline-none focus:border-teal-500" />
                  </div>

                  <div className="w-24 relative">
                    <input type="number" min="0" max="100" value={line.discountPercent} onChange={e => updateLine(idx, "discountPercent", e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-2 pr-6 py-1.5 text-xs text-white text-right outline-none focus:border-teal-500" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold">%</span>
                  </div>

                  <div className="w-24 flex items-center justify-end text-xs font-mono text-white font-bold pr-1">
                    {formatAmount(line.total)}
                  </div>

                  <div className="w-8 flex items-center justify-center">
                    <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1} className="text-rose-500 hover:text-rose-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  
                </div>
              );
            })}
            <div className="p-2 bg-black/20 rounded-b-xl">
              <button onClick={() => setLines([...lines, { productId: "", batchId: "", warehouseId: "", quantity: 1, unitPrice: 0, discountPercent: 0, total: 0, discountAmount: 0 }])} className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
            </div>
          </div>

          {/* Notes & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Invoice Notes</label>
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add terms, tracking numbers..." className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-teal-500 outline-none resize-none" />
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between text-sm text-zinc-400"><span>Subtotal</span><span className="font-mono">{formatAmount(subtotal)}</span></div>
              
              {sales?.allowDiscounts !== false && (
                <div className="flex justify-between items-center text-sm text-zinc-400">
                  <span>Invoice Discount</span>
                  <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-24 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-right font-mono text-white outline-none focus:border-teal-500" />
                </div>
              )}

              {orderType === "COD" && (
                <div className="flex justify-between items-center text-sm text-zinc-400">
                  <span>Tax ({sales?.defaultTaxRate || 0}%)</span>
                  <span className="font-mono text-white">{formatAmount(calculatedTax)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center text-sm text-zinc-400">
                <span>Delivery</span>
                <input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(Number(e.target.value))} className="w-24 bg-zinc-900 border border-white/10 rounded px-2 py-1 text-right font-mono text-white outline-none focus:border-teal-500" />
              </div>
              
              <div className="border-t border-white/10 pt-3 flex justify-between font-bold text-lg text-white">
                <span>Total</span>
                <span className="font-mono text-teal-400">{currency} {formatAmount(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={() => handleSubmit("DRAFT")} disabled={saving} className="px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 flex items-center gap-2 transition-colors">
            <Save className="w-4 h-4" /> Save Draft
          </button>
          <button onClick={() => handleSubmit("POSTED")} disabled={saving} className="px-6 py-2.5 rounded-lg bg-teal-500 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Finalize & Post</>}
          </button>
        </div>

      </div>
    </div>
  );
}