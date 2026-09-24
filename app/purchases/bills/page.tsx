"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Eye, Edit, Trash2, Undo2, LayoutGrid, RotateCcw, Plus, Search, Layers } from "lucide-react";
import ERPShell from "@/app/components/erp-shell";

type PurchaseBill = {
  id: string; billNo: string; billDate: string;
  status: "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "VOID";
  total: number | string; balance: number | string; notes: string | null;
  supplier: { name: string; }; lines: any[];
};

type AllocationLine = {
  id: string;
  isNewItem: boolean; productId: string; name: string;
  isNewCat: boolean; categoryId: string; newCatName: string;
  isNewBrand: boolean; brandId: string; newBrandName: string;
  isNewUnit: boolean; unitId: string; newUnitName: string;
  batchNo: string; yieldQty: number | string; weightGrams: number | string;
  unitCost: number | string; totalCost: number | string;
};

function money(amount: number | string) {
  return `Rs ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PurchaseBillsPage() {
  const router = useRouter();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Allocation Modal State
  const [allocatingBill, setAllocatingBill] = useState<PurchaseBill | null>(null);
  const [allocLines, setAllocLines] = useState<AllocationLine[]>([]);
  
  // Balancer Adjustments
  const [cartonWeight, setCartonWeight] = useState<number | string>("");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountVal, setDiscountVal] = useState<number | string>(0);
  const [adjustmentVal, setAdjustmentVal] = useState<number | string>(0);
  const [deliveryCharges, setDeliveryCharges] = useState<number | string>(0);
  
  // View States
  const [viewingBill, setViewingBill] = useState<PurchaseBill | null>(null);
  const [viewingAllocation, setViewingAllocation] = useState<any[] | null>(null);

  // Master Data
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  async function loadBills() {
    try {
      setLoading(true);
      const res = await fetch(`/api/purchases/bills?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.ok) setBills(data.bills || []);
      else toast.error("Failed to load bills");
    } catch { toast.error("Connection error."); } finally { setLoading(false); }
  }

  useEffect(() => { loadBills(); }, []);

  useEffect(() => {
    if (allocatingBill) {
      fetch("/api/purchases/bills/allocate/master")
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            setProducts(data.products || []);
            setCategories(data.categories || []);
            setBrands(data.brands || []);
            setUnits(data.units || []);
          }
        })
        .catch(err => console.error("Failed to load master data", err));
    }
  }, [allocatingBill]);

  async function handleAction(id: string, action: "POST" | "REVERSE" | "DELETE") {
    if (!window.confirm(`Are you sure you want to ${action} this bill?`)) return;
    try {
      setActionLoading(id);
      const res = action === "DELETE" 
        ? await fetch(`/api/purchases/bills?id=${id}`, { method: "DELETE" })
        : await fetch("/api/purchases/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await res.json();
      if (data.ok) { toast.success(`Success!`); loadBills(); }
      else toast.error(data.error || "Action failed.");
    } catch { toast.error("Failed to execute action."); } finally { setActionLoading(null); }
  }

  async function openAllocationDetails(billId: string) {
    try {
      const res = await fetch(`/api/purchases/bills/allocate?billId=${billId}`);
      const data = await res.json();
      if (data.ok) setViewingAllocation(data.allocations);
      else toast.error(data.error);
    } catch { toast.error("Failed to fetch allocation details."); }
  }

  async function undoAllocation(billId: string) {
    if (!window.confirm("Undo this allocation? This pulls the items out of stock and restores your bulk purchase.")) return;
    try {
      setActionLoading(billId);
      const res = await fetch(`/api/purchases/bills/allocate?billId=${billId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) { toast.success("Allocation Undone!"); loadBills(); }
      else toast.error(data.error || "Failed to undo.");
    } catch { toast.error("Action failed."); } finally { setActionLoading(null); }
  }

  function openAllocation(bill: PurchaseBill) {
    if (bill.notes?.includes("[REPACKAGED]")) return toast.error("This bill has already been allocated.");
    setAllocatingBill(bill);
    setAllocLines([{ id: Math.random().toString(), isNewItem: false, productId: "", name: "", isNewCat: false, categoryId: "", newCatName: "", isNewBrand: false, brandId: "", newBrandName: "", isNewUnit: false, unitId: "", newUnitName: "", batchNo: "", yieldQty: "", weightGrams: "", unitCost: "", totalCost: "" }]);
    setCartonWeight(""); setDiscountVal(0); setAdjustmentVal(0); setDeliveryCharges(0); setDiscountType("FLAT");
  }

  function addAllocLine() {
    setAllocLines(prev => [...prev, { id: Math.random().toString(), isNewItem: false, productId: "", name: "", isNewCat: false, categoryId: "", newCatName: "", isNewBrand: false, brandId: "", newBrandName: "", isNewUnit: false, unitId: "", newUnitName: "", batchNo: "", yieldQty: "", weightGrams: "", unitCost: "", totalCost: "" }]);
  }

  function updateAllocLine(id: string, field: keyof AllocationLine, val: any) {
    setAllocLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      
      if (field === "productId") { 
        if (val === "NEW") { 
          updated.isNewItem = true; updated.productId = ""; updated.name = ""; 
          updated.categoryId = ""; updated.brandId = ""; updated.unitId = "";
        } else { 
          updated.isNewItem = false; updated.name = ""; 
          const selectedProduct = products.find(p => p.id === val);
          if (selectedProduct) {
            updated.categoryId = selectedProduct.categoryId || "";
            updated.brandId = selectedProduct.brandId || "";
            updated.unitId = selectedProduct.unitId || "";
          }
        } 
      }
      if (field === "categoryId") { if (val === "NEW") { updated.isNewCat = true; updated.categoryId = ""; } else { updated.isNewCat = false; updated.newCatName = ""; } }
      if (field === "brandId") { if (val === "NEW") { updated.isNewBrand = true; updated.brandId = ""; } else { updated.isNewBrand = false; updated.newBrandName = ""; } }
      if (field === "unitId") { if (val === "NEW") { updated.isNewUnit = true; updated.unitId = ""; } else { updated.isNewUnit = false; updated.newUnitName = ""; } }
      
      if (field === "totalCost") {
        const qty = Number(updated.yieldQty) || 0;
        updated.unitCost = qty > 0 ? (Number(val) / qty).toFixed(2) : 0;
      }
      if (field === "yieldQty" && Number(updated.totalCost) > 0) {
        updated.unitCost = (Number(updated.totalCost) / Number(val)).toFixed(2);
      }
      
      return updated;
    }));
  }

  const itemsSubtotal = useMemo(() => allocLines.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0), [allocLines]);
  const calcDiscount = discountType === "PERCENT" ? (itemsSubtotal * (Number(discountVal) || 0)) / 100 : (Number(discountVal) || 0);
  const calcAdjustment = Number(adjustmentVal) || 0;
  const calcDelivery = Number(deliveryCharges) || 0;
  const targetTotal = Number(allocatingBill?.total || 0);
  const netAllocated = itemsSubtotal - calcDiscount + calcAdjustment + calcDelivery;
  const amountBalanceRemaining = targetTotal - netAllocated;

  const targetWeight = useMemo(() => {
    if (!allocatingBill || !allocatingBill.lines) return 0;
    return allocatingBill.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  }, [allocatingBill]);

  const allocatedItemsWeight = useMemo(() => allocLines.reduce((sum, l) => sum + (Number(l.weightGrams) || 0), 0), [allocLines]);
  const totalAllocatedWeight = allocatedItemsWeight + (Number(cartonWeight) || 0);
  const weightBalanceRemaining = targetWeight - totalAllocatedWeight;

  function autoDistributeCosts() {
    if (allocatedItemsWeight <= 0) return toast.error("Enter weights to distribute costs.");
    if (Math.abs(weightBalanceRemaining) > 0.5) return toast.error(`Balance the physical weight first! Variance: ${weightBalanceRemaining}g.`);
    
    const requiredSubtotal = targetTotal + calcDiscount - calcAdjustment - calcDelivery;

    setAllocLines(prev => prev.map(l => {
      const weight = Number(l.weightGrams) || 0;
      const proportion = weight / allocatedItemsWeight;
      const assignedCost = requiredSubtotal * proportion;
      const qty = Number(l.yieldQty) || 0;
      return { 
        ...l, 
        totalCost: assignedCost.toFixed(2),
        unitCost: qty > 0 ? (assignedCost / qty).toFixed(2) : "0.00"
      };
    }));
    toast.success("Costs distributed perfectly!");
  }

  async function submitAllocation() {
    if (Math.abs(amountBalanceRemaining) > 0.05) return toast.error("Amount Balance must be exactly Rs 0.00!");
    if (Math.abs(weightBalanceRemaining) > 0.5) return toast.error("Physical Weight must be perfectly balanced!");
    
    for (const line of allocLines) {
      if (line.isNewItem && (!line.name || line.name.trim() === "")) return toast.error("Provide a name for all new items.");
      if (Number(line.yieldQty) <= 0) return toast.error("Yield Quantity must be > 0.");
    }

    try {
      setIsSubmitting(true);
      const payload = { billId: allocatingBill!.id, allocations: allocLines, adjustments: { discountVal, adjustmentVal, deliveryCharges, cartonWeight } };
      const res = await fetch("/api/purchases/bills/allocate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.ok) { toast.success("Stock allocated successfully!"); setAllocatingBill(null); loadBills(); } 
      else toast.error(data.error || "Failed to allocate stock.");
    } catch { toast.error("Network error."); } finally { setIsSubmitting(false); }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans antialiased relative">
      <Toaster position="top-right" />
      <ERPShell title="Purchase Bills">
        <div className="max-w-7xl mx-auto p-8 space-y-6">
          
          {/* Header */}
          <div className="flex justify-between items-center bg-gradient-to-r from-[#004e54] to-[#009b9b] p-6 rounded-xl shadow-sm border border-teal-800/50">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Purchase Bills</h1>
              <p className="text-teal-50 mt-1 text-sm opacity-90">Manage vendor procurement, batch receiving, and stock allocation.</p>
            </div>
            <Link href="/purchases/bills/new" className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Bill
            </Link>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 shadow-sm overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-800 flex gap-3 bg-zinc-900/50">
              <div className="relative w-96">
                <Search className="absolute left-3 top-2.5 text-zinc-500 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search by Bill # or Supplier..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  onKeyDown={(e) => e.key === "Enter" && loadBills()} 
                  className="w-full bg-zinc-950 border border-zinc-700 text-white pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all placeholder-zinc-500" 
                />
              </div>
              <button onClick={loadBills} className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors border border-zinc-700">
                Search
              </button>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto min-h-[400px]">
              {loading ? (
                <div className="text-center py-20 text-teal-400 font-medium animate-pulse">Loading ledgers...</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-wider font-semibold border-b border-zinc-800">
                      <th className="py-4 px-6">Bill #</th>
                      <th className="py-4 px-6">Date</th>
                      <th className="py-4 px-6">Supplier</th>
                      <th className="py-4 px-6">Total</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-sm">
                    {bills.map((bill) => {
                      const isRepackaged = bill.notes?.includes("[REPACKAGED]");
                      return (
                      <tr key={bill.id} className="hover:bg-zinc-800/40 transition-colors group">
                        
                        {/* FIX APPLIED HERE: Moved flex container into a div */}
                        <td className="py-4 px-6 font-medium text-white">
                          <div className="flex items-center gap-3">
                            {bill.billNo}
                            {isRepackaged && (
                              <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                                Repackaged
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-4 px-6 text-zinc-400">{new Date(bill.billDate).toISOString().slice(0, 10)}</td>
                        <td className="py-4 px-6">{bill.supplier?.name}</td>
                        <td className="py-4 px-6 font-medium text-white">{money(bill.total)}</td>
                        
                        <td className="py-4 px-6 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
                            bill.status === "POSTED" 
                              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {bill.status}
                          </span>
                        </td>
                        
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewingBill(bill)} className="text-zinc-400 hover:text-white p-2 transition-colors" title="Quick View">
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            {bill.status === "DRAFT" && (
                              <>
                                <button onClick={() => toast.error("Use Edit page for this.")} className="text-zinc-400 hover:text-amber-400 transition" title="Edit Bill"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleAction(bill.id, "DELETE")} className="text-zinc-400 hover:text-rose-500 transition" title="Delete Draft"><Trash2 className="w-4 h-4" /></button>
                                <button onClick={() => handleAction(bill.id, "POST")} className="text-xs bg-teal-600/20 text-teal-400 border border-teal-500/20 hover:bg-teal-600 hover:text-white px-2 py-1 rounded font-bold uppercase transition ml-1">Post</button>
                              </>
                            )}
                            
                            {bill.status === "POSTED" && !isRepackaged && (
                              <>
                                <button onClick={() => openAllocation(bill)} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow-sm flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5" /> Allocate
                                </button>
                                <button onClick={() => handleAction(bill.id, "REVERSE")} className="text-zinc-400 hover:text-rose-500 p-2 transition-colors ml-1" title="Reverse Bill"><RotateCcw className="w-4 h-4" /></button>
                              </>
                            )}
                            
                            {bill.status === "POSTED" && isRepackaged && (
                              <>
                                <button onClick={() => openAllocationDetails(bill.id)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border border-zinc-700 flex items-center gap-2">
                                  <LayoutGrid className="w-3.5 h-3.5"/> View
                                </button>
                                <button onClick={() => undoAllocation(bill.id)} className="text-zinc-400 hover:text-amber-500 p-2 transition-colors ml-1" title="Undo Allocation"><Undo2 className="w-4 h-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </ERPShell>

      {/* VIEW BILL MODAL */}
      {viewingBill && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Purchase Bill {viewingBill.billNo}</h2>
                <p className="text-zinc-400 text-sm mt-1">{viewingBill.supplier?.name} • {new Date(viewingBill.billDate).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setViewingBill(null)} className="text-zinc-500 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-5 space-y-3">
              <div className="flex justify-between text-sm text-zinc-400 border-b border-zinc-800 pb-3"><span>Status</span><strong className="text-white">{viewingBill.status}</strong></div>
              <div className="flex justify-between text-sm text-zinc-400 border-b border-zinc-800 pb-3"><span>Total Amount</span><strong className="text-teal-400">{money(viewingBill.total)}</strong></div>
              <div className="flex justify-between text-sm text-zinc-400"><span>Notes</span><span className="text-white text-right max-w-sm">{viewingBill.notes || "None"}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ALLOCATION DETAILS MODAL */}
      {viewingAllocation && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Allocation Details</h2>
                <p className="text-teal-400 text-xs mt-1 font-bold uppercase tracking-widest">Items generated from bulk purchase</p>
              </div>
              <button onClick={() => setViewingAllocation(null)} className="text-zinc-500 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/50 text-zinc-400 text-[10px] uppercase border-b border-zinc-800 font-semibold tracking-wider">
                  <tr>
                    <th className="p-4">Product Breakdown</th>
                    <th className="p-4 text-center">Yield Qty</th>
                    <th className="p-4 text-right">Unit Cost</th>
                    <th className="p-4 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {viewingAllocation.map((mov, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 text-zinc-300 transition-colors">
                      <td className="p-4 font-medium">
                        {mov.product?.name} 
                        <span className="block text-[10px] text-zinc-500 mt-0.5">
                          {mov.product?.category?.name || "No Category"} • {mov.product?.brand?.name || "No Brand"}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-white">{mov.quantity}</td>
                      <td className="p-4 text-right">{money(mov.unitCost)}</td>
                      <td className="p-4 text-right text-teal-400 font-bold">{money(mov.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ZERO-BALANCE ALLOCATION MODAL */}
      {allocatingBill && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-[95vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in">
            
            <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Stock Allocation & Re-Packaging</h2>
                <p className="text-xs text-teal-400 font-bold uppercase tracking-widest mt-1">Bill {allocatingBill.billNo} • Target: {targetWeight}g / {money(targetTotal)}</p>
              </div>
              <button onClick={() => setAllocatingBill(null)} disabled={isSubmitting} className="text-zinc-500 hover:text-white text-3xl transition">&times;</button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6 bg-zinc-950 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold border-b border-zinc-800 pb-2">
                    <th className="pb-3 px-2 w-48">Item Name</th>
                    <th className="pb-3 px-2 w-24">Batch</th>
                    <th className="pb-3 px-2 w-32">Category</th>
                    <th className="pb-3 px-2 w-32">Brand</th>
                    <th className="pb-3 px-2 w-24">Unit</th>
                    <th className="pb-3 px-2 w-20 text-center">Yield Qty</th>
                    <th className="pb-3 px-2 w-24 text-center">Weight (g)</th>
                    <th className="pb-3 px-2 w-24 text-right">Unit Cost</th>
                    <th className="pb-3 px-2 w-28 text-right">Total Cost</th>
                    <th className="pb-3 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {allocLines.map((line) => (
                    <tr key={line.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 px-2">
                        {line.isNewItem ? (
                          <div className="flex gap-1 relative">
                            <input type="text" placeholder="New Item..." value={line.name} onChange={e => updateAllocLine(line.id, "name", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "productId", "")} className="absolute right-1 top-1.5 text-xs text-rose-500 hover:text-rose-400 font-bold px-1">&times;</button>
                          </div>
                        ) : (
                          <select value={line.productId} onChange={e => updateAllocLine(line.id, "productId", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors">
                            <option value="">Select Item...</option>
                            <option value="NEW" className="font-bold text-teal-400">+ New Item</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      
                      <td className="py-3 px-2"><input type="text" placeholder="Auto" value={line.batchNo} onChange={e => updateAllocLine(line.id, "batchNo", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors" /></td>
                      
                      <td className="py-3 px-2">
                        {line.isNewCat ? (
                          <div className="flex gap-1 relative">
                            <input type="text" placeholder="New Cat..." value={line.newCatName} onChange={e => updateAllocLine(line.id, "newCatName", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "categoryId", "")} className="absolute right-1 top-1.5 text-xs text-rose-500 hover:text-rose-400 font-bold px-1">&times;</button>
                          </div>
                        ) : (
                          <select value={line.categoryId} onChange={e => updateAllocLine(line.id, "categoryId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 disabled:opacity-50 transition-colors">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-teal-400">+ New Cat</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        {line.isNewBrand ? (
                          <div className="flex gap-1 relative">
                            <input type="text" placeholder="New Brand..." value={line.newBrandName} onChange={e => updateAllocLine(line.id, "newBrandName", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "brandId", "")} className="absolute right-1 top-1.5 text-xs text-rose-500 hover:text-rose-400 font-bold px-1">&times;</button>
                          </div>
                        ) : (
                          <select value={line.brandId} onChange={e => updateAllocLine(line.id, "brandId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 disabled:opacity-50 transition-colors">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-teal-400">+ New Brand</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        {line.isNewUnit ? (
                          <div className="flex gap-1 relative">
                            <input type="text" placeholder="New Unit..." value={line.newUnitName} onChange={e => updateAllocLine(line.id, "newUnitName", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 transition-colors" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "unitId", "")} className="absolute right-1 top-1.5 text-xs text-rose-500 hover:text-rose-400 font-bold px-1">&times;</button>
                          </div>
                        ) : (
                          <select value={line.unitId} onChange={e => updateAllocLine(line.id, "unitId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none focus:border-teal-500 disabled:opacity-50 transition-colors">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-teal-400">+ New Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        )}
                      </td>

                      <td className="py-3 px-2"><input type="number" min="0" value={line.yieldQty} onChange={e => updateAllocLine(line.id, "yieldQty", e.target.value)} className="w-full bg-zinc-950 text-zinc-200 border border-zinc-700 rounded p-1.5 text-xs outline-none text-center focus:border-teal-500 transition-colors" /></td>
                      <td className="py-3 px-2"><input type="number" min="0" value={line.weightGrams} onChange={e => updateAllocLine(line.id, "weightGrams", e.target.value)} className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded p-1.5 text-xs outline-none text-center focus:border-amber-500 font-bold transition-colors" /></td>
                      <td className="py-3 px-2"><input type="number" min="0" value={line.unitCost} readOnly className="w-full bg-zinc-900 text-zinc-500 border border-zinc-800 rounded p-1.5 text-xs outline-none text-right font-bold cursor-not-allowed" /></td>
                      <td className="py-3 px-2"><input type="number" min="0" value={line.totalCost} onChange={e => updateAllocLine(line.id, "totalCost", e.target.value)} className="w-full bg-teal-500/10 text-teal-300 border border-teal-500/30 rounded p-1.5 text-xs outline-none text-right font-bold focus:border-teal-500 transition-colors" /></td>
                      
                      <td className="py-3 px-2 text-center"><button onClick={() => setAllocLines(prev => prev.filter(l => l.id !== line.id))} className="text-zinc-600 hover:text-rose-500 font-bold transition-colors"><Trash2 className="w-4 h-4 mx-auto"/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addAllocLine} className="mt-4 text-xs font-bold text-teal-400 hover:text-teal-300 uppercase tracking-widest flex items-center gap-1 transition-colors"><Plus className="w-3 h-3"/> Add Row</button>
            </div>

            <div className="border-t border-zinc-800 flex flex-col lg:flex-row gap-0 bg-zinc-900">
              
              <div className="p-6 lg:w-1/3 border-r border-zinc-800 space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Adjustments & Extra Costs</h3>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400 flex items-center gap-2">Discount 
                    <button onClick={() => setDiscountType(t => t === "FLAT" ? "PERCENT" : "FLAT")} className="text-[10px] bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded font-bold hover:bg-zinc-700 text-zinc-300 transition-colors">{discountType === "FLAT" ? "₨" : "%"}</button>
                  </span>
                  <input type="number" min="0" value={discountVal} onChange={e => setDiscountVal(e.target.value)} className="w-24 bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 outline-none text-right focus:border-teal-500 text-xs transition-colors" />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Adjustment (+/-)</span>
                  <input type="number" value={adjustmentVal} onChange={e => setAdjustmentVal(e.target.value)} className="w-24 bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 outline-none text-right focus:border-teal-500 text-xs transition-colors" />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Delivery (Expensed)</span>
                  <input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(e.target.value)} className="w-24 bg-zinc-950 text-zinc-200 border border-zinc-700 rounded px-2 py-1.5 outline-none text-right focus:border-teal-500 text-xs transition-colors" />
                </div>
                
                <div className="flex justify-between items-center text-sm pt-4 mt-2 border-t border-zinc-800">
                  <span className="text-amber-500 font-semibold">Carton/Scrap Wt. (g)</span>
                  <input type="number" min="0" placeholder="1500" value={cartonWeight} onChange={e => setCartonWeight(e.target.value)} className="w-24 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded px-2 py-1.5 outline-none text-right font-bold focus:border-amber-500 text-xs transition-colors" />
                </div>
                
                <button onClick={autoDistributeCosts} className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-teal-400 border border-zinc-700 rounded-lg py-2.5 text-xs font-bold uppercase tracking-widest transition-colors shadow-sm">
                  Auto-Distribute Costs by Weight
                </button>
              </div>

              <div className="bg-zinc-950 p-6 lg:w-2/3 flex flex-col justify-between">
                
                <div className="flex flex-col gap-4 mb-6">
                  {/* Weight Balancer */}
                  <div className="flex flex-wrap justify-between items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-sm">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Target Bulk Weight</div>
                      <div className="text-lg font-bold text-white mt-0.5">{targetWeight} <span className="text-sm text-zinc-400">g</span></div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">-</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Allocated Wt.</div>
                      <div className="text-lg font-bold text-amber-500 mt-0.5">{allocatedItemsWeight} <span className="text-sm text-amber-500/50">g</span></div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">-</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Carton Wt.</div>
                      <div className="text-lg font-bold text-zinc-400 mt-0.5">{Number(cartonWeight) || 0} <span className="text-sm text-zinc-600">g</span></div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">=</div>
                    <div className="bg-zinc-950 px-5 py-2 rounded-lg border border-zinc-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Weight Balance</div>
                      <div className={`text-xl font-black mt-0.5 ${Math.abs(weightBalanceRemaining) < 0.5 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {weightBalanceRemaining} <span className="text-sm font-bold opacity-50">g</span>
                      </div>
                    </div>
                  </div>

                  {/* Amount Balancer */}
                  <div className="flex flex-wrap justify-between items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-sm">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Target Bill Total</div>
                      <div className="text-lg font-bold text-white mt-0.5">{money(targetTotal)}</div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">-</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Items Subtotal</div>
                      <div className="text-lg font-bold text-teal-400 mt-0.5">{money(itemsSubtotal)}</div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">+/-</div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Adj. & Delivery</div>
                      <div className="text-lg font-bold text-zinc-400 mt-0.5">{money(calcAdjustment + calcDelivery - calcDiscount)}</div>
                    </div>
                    <div className="text-zinc-700 text-xl font-light">=</div>
                    <div className="bg-zinc-950 px-5 py-2 rounded-lg border border-zinc-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Amount Balance</div>
                      <div className={`text-xl font-black mt-0.5 ${Math.abs(amountBalanceRemaining) < 0.05 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        {money(amountBalanceRemaining)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setAllocatingBill(null)} disabled={isSubmitting} className="px-6 py-2.5 text-sm font-semibold text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700">Cancel</button>
                  <button 
                    onClick={submitAllocation} 
                    disabled={isSubmitting || Math.abs(amountBalanceRemaining) > 0.05 || Math.abs(weightBalanceRemaining) > 0.5} 
                    className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? "Finalizing..." : "Finalize Adjustment"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(82, 82, 91, 0.5); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(113, 113, 122, 0.8); }
        .animate-fade-in { animation: fadeIn 0.15s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.99); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
