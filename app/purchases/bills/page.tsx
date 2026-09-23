"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";

type PurchaseBill = {
  id: string;
  billNo: string;
  billDate: string;
  status: "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "VOID";
  total: number;
  balance: number;
  supplier: { name: string; };
  lines: any[];
};

type AllocationLine = {
  id: string;
  isNewItem: boolean;
  productId: string;
  name: string;
  isNewCat: boolean;
  categoryId: string;
  newCatName: string;
  isNewBrand: boolean;
  brandId: string;
  newBrandName: string;
  isNewUnit: boolean;
  unitId: string;
  newUnitName: string;
  batchNo: string;
  yieldQty: number | string;
  weightGrams: number | string;
  unitCost: number | string;
  totalCost: number | string;
};

function money(amount: number | string) {
  return `Rs ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Allocation Modal State
  const [allocatingBill, setAllocatingBill] = useState<PurchaseBill | null>(null);
  const [allocLines, setAllocLines] = useState<AllocationLine[]>([]);
  
  // Balancer Adjustments
  const [cartonWeight, setCartonWeight] = useState<number | string>("");
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [discountVal, setDiscountVal] = useState<number | string>(0);
  const [adjustmentVal, setAdjustmentVal] = useState<number | string>(0);
  const [deliveryCharges, setDeliveryCharges] = useState<number | string>(0);
  
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
      else toast.error(data.error || "Failed to load bills");
    } catch { toast.error("Failed to connect to server."); } 
    finally { setLoading(false); }
  }

  useEffect(() => { loadBills(); }, []);

  useEffect(() => {
    if (allocatingBill) {
      Promise.all([
        fetch("/api/products").then(r => r.json()).catch(() => ({})),
        fetch("/api/categories").then(r => r.json()).catch(() => ({})),
        fetch("/api/brands").then(r => r.json()).catch(() => ({})),
        fetch("/api/units").then(r => r.json()).catch(() => ({}))
      ]).then(([p, c, b, u]) => {
        setProducts(p.products || p.data || []);
        setCategories(c.categories || c.data || []);
        setBrands(b.brands || b.data || []);
        setUnits(u.units || u.data || []);
      });
    }
  }, [allocatingBill]);

  async function handleAction(id: string, action: "POST" | "REVERSE") {
    if (!window.confirm(`Are you sure you want to ${action} this bill?`)) return;
    try {
      setActionLoading(id);
      const res = await fetch("/api/purchases/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await res.json();
      if (data.ok) { toast.success(`Bill successfully updated.`); loadBills(); }
      else toast.error(data.error || "Action failed.");
    } catch { toast.error("Failed to execute action."); } 
    finally { setActionLoading(null); }
  }

  function openAllocation(bill: PurchaseBill) {
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
      
      // Auto-Create Logic & Unit Cost Back-Calculation
      if (field === "productId") { if (val === "NEW") { updated.isNewItem = true; updated.productId = ""; } else { updated.isNewItem = false; updated.name = ""; } }
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

  // Calculate Net Values
  const itemsSubtotal = useMemo(() => allocLines.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0), [allocLines]);
  const calcDiscount = discountType === "PERCENT" ? (itemsSubtotal * (Number(discountVal) || 0)) / 100 : (Number(discountVal) || 0);
  const calcAdjustment = Number(adjustmentVal) || 0;
  const calcDelivery = Number(deliveryCharges) || 0;
  
  const netAllocated = itemsSubtotal - calcDiscount + calcAdjustment + calcDelivery;
  const targetTotal = allocatingBill?.total || 0;
  const balanceRemaining = targetTotal - netAllocated;

  function autoDistributeCosts() {
    const totalWeight = allocLines.reduce((sum, l) => sum + (Number(l.weightGrams) || 0), 0);
    if (totalWeight <= 0) return toast.error("Enter weights for your items to distribute costs.");
    
    // Distribute the exact amount needed for the items subtotal to balance the bill
    // Needed Items Subtotal = Target Bill Total + Discount - Adjustment - Delivery
    const requiredSubtotal = targetTotal + calcDiscount - calcAdjustment - calcDelivery;

    setAllocLines(prev => prev.map(l => {
      const weight = Number(l.weightGrams) || 0;
      const proportion = weight / totalWeight;
      const assignedCost = requiredSubtotal * proportion;
      const qty = Number(l.yieldQty) || 0;
      return { 
        ...l, 
        totalCost: assignedCost.toFixed(2),
        unitCost: qty > 0 ? (assignedCost / qty).toFixed(2) : "0.00"
      };
    }));
    toast.success("Costs distributed perfectly by weight!");
  }

  async function submitAllocation() {
    if (Math.abs(balanceRemaining) > 0.05) return toast.error("Balance must be exactly Rs 0.00 before finalizing!");
    toast.success("Allocation Payload Ready for backend.");
  }

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 font-sans relative">
      <Toaster position="top-right" />
      <ERPShell title="Purchase Bills">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          
          <div className="flex justify-between items-center bg-[#131C2F] p-6 rounded-xl shadow-sm border border-slate-800">
            <div>
              <h1 className="text-xl font-bold text-white">Purchase Bills</h1>
              <p className="text-xs text-slate-400 mt-1">Manage vendor procurement, batch receiving, and stock allocation.</p>
            </div>
            <Link href="/purchases/bills/new" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">+ Create Bill</Link>
          </div>

          <div className="bg-[#131C2F] rounded-xl shadow-sm border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex gap-3">
              <input type="text" placeholder="Search by Bill # or Supplier..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadBills()} className="bg-white text-black border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-72" />
              <button onClick={loadBills} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition">Search</button>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              {loading ? (
                <div className="text-center py-20 text-blue-400 font-bold animate-pulse">Loading ledgers...</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap bg-[#131C2F]">
                  <thead className="bg-[#0B1121] text-slate-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-4 font-semibold border-b border-slate-800">Bill #</th>
                      <th className="p-4 font-semibold border-b border-slate-800">Date</th>
                      <th className="p-4 font-semibold border-b border-slate-800">Supplier</th>
                      <th className="p-4 font-semibold text-right border-b border-slate-800">Total</th>
                      <th className="p-4 font-semibold text-center border-b border-slate-800">Status</th>
                      <th className="p-4 font-semibold text-center border-b border-slate-800">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-white transition-colors group">
                        <td className="p-4 font-bold text-white group-hover:text-black transition-colors">{bill.billNo}</td>
                        <td className="p-4 text-slate-400 group-hover:text-black transition-colors">{new Date(bill.billDate).toISOString().slice(0, 10)}</td>
                        <td className="p-4 text-blue-400 group-hover:text-black transition-colors font-semibold">{bill.supplier?.name}</td>
                        <td className="p-4 text-right font-bold text-slate-200 group-hover:text-black transition-colors">{money(bill.total)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${bill.status === "POSTED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>{bill.status}</span>
                        </td>
                        <td className="p-4 text-center space-x-2">
                          {bill.status === "DRAFT" && (
                            <button onClick={() => handleAction(bill.id, "POST")} disabled={actionLoading === bill.id} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] uppercase font-bold tracking-wider transition">Post</button>
                          )}
                          {bill.status === "POSTED" && (
                            <>
                              <button onClick={() => openAllocation(bill)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] uppercase font-bold tracking-wider transition shadow-lg shadow-blue-500/20">Allocate Stock</button>
                              <button onClick={() => handleAction(bill.id, "REVERSE")} disabled={actionLoading === bill.id} className="px-3 py-1 bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white rounded text-[10px] uppercase font-bold tracking-wider transition">Reverse</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </ERPShell>

      {/* ZERO-BALANCE ALLOCATION MODAL (DARK THEME) */}
      {allocatingBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131C2F] border border-slate-700 w-full max-w-[95vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in">
            
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-[#0B1121]">
              <div>
                <h2 className="text-xl font-bold text-white">Stock Allocation & Re-Packaging</h2>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-1">Bill {allocatingBill.billNo} • Target Balance: {money(allocatingBill.total)}</p>
              </div>
              <button onClick={() => setAllocatingBill(null)} className="text-slate-500 hover:text-white text-3xl transition">&times;</button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-500 font-bold border-b border-slate-800">
                    <th className="pb-3 px-1 w-48">Item Name</th>
                    <th className="pb-3 px-1 w-24">Batch</th>
                    <th className="pb-3 px-1 w-32">Category</th>
                    <th className="pb-3 px-1 w-32">Brand</th>
                    <th className="pb-3 px-1 w-24">Unit</th>
                    <th className="pb-3 px-1 w-20 text-center">Yield Qty</th>
                    <th className="pb-3 px-1 w-24 text-center">Weight (g)</th>
                    <th className="pb-3 px-1 w-24 text-right">Unit Cost</th>
                    <th className="pb-3 px-1 w-28 text-right">Total Cost</th>
                    <th className="pb-3 px-1 w-10 text-center">X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {allocLines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-800/30 transition-colors">
                      
                      {/* Item Name */}
                      <td className="py-2 px-1">
                        {line.isNewItem ? (
                          <div className="flex gap-1">
                            <input type="text" placeholder="New Item..." value={line.name} onChange={e => updateAllocLine(line.id, "name", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "productId", "")} className="text-xs text-rose-400 font-bold px-1 hover:text-rose-300">&times;</button>
                          </div>
                        ) : (
                          <select value={line.productId} onChange={e => updateAllocLine(line.id, "productId", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500">
                            <option value="">Select Item...</option>
                            <option value="NEW" className="font-bold text-blue-600">+ New Item</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      
                      {/* Batch */}
                      <td className="py-2 px-1"><input type="text" placeholder="Auto" value={line.batchNo} onChange={e => updateAllocLine(line.id, "batchNo", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500" /></td>
                      
                      {/* Category */}
                      <td className="py-2 px-1">
                        {line.isNewCat ? (
                          <div className="flex gap-1">
                            <input type="text" placeholder="New Cat..." value={line.newCatName} onChange={e => updateAllocLine(line.id, "newCatName", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "categoryId", "")} className="text-xs text-rose-400 font-bold px-1 hover:text-rose-300">&times;</button>
                          </div>
                        ) : (
                          <select value={line.categoryId} onChange={e => updateAllocLine(line.id, "categoryId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500 disabled:opacity-50">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-blue-600">+ New Cat</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                      </td>

                      {/* Brand */}
                      <td className="py-2 px-1">
                        {line.isNewBrand ? (
                          <div className="flex gap-1">
                            <input type="text" placeholder="New Brand..." value={line.newBrandName} onChange={e => updateAllocLine(line.id, "newBrandName", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "brandId", "")} className="text-xs text-rose-400 font-bold px-1 hover:text-rose-300">&times;</button>
                          </div>
                        ) : (
                          <select value={line.brandId} onChange={e => updateAllocLine(line.id, "brandId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500 disabled:opacity-50">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-blue-600">+ New Brand</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-1">
                        {line.isNewUnit ? (
                          <div className="flex gap-1">
                            <input type="text" placeholder="New Unit..." value={line.newUnitName} onChange={e => updateAllocLine(line.id, "newUnitName", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "unitId", "")} className="text-xs text-rose-400 font-bold px-1 hover:text-rose-300">&times;</button>
                          </div>
                        ) : (
                          <select value={line.unitId} onChange={e => updateAllocLine(line.id, "unitId", e.target.value)} disabled={!line.isNewItem} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none focus:border-blue-500 disabled:opacity-50">
                            <option value="">Select...</option>
                            <option value="NEW" className="font-bold text-blue-600">+ New Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        )}
                      </td>

                      {/* Yield, Weight, Cost */}
                      <td className="py-2 px-1"><input type="number" min="0" value={line.yieldQty} onChange={e => updateAllocLine(line.id, "yieldQty", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none text-center focus:border-blue-500" /></td>
                      <td className="py-2 px-1"><input type="number" min="0" value={line.weightGrams} onChange={e => updateAllocLine(line.id, "weightGrams", e.target.value)} className="w-full bg-white text-black border border-slate-300 rounded p-1.5 text-xs outline-none text-center focus:border-blue-500" /></td>
                      <td className="py-2 px-1"><input type="number" min="0" value={line.unitCost} readOnly className="w-full bg-slate-100 text-slate-500 border border-slate-300 rounded p-1.5 text-xs outline-none text-right font-bold cursor-not-allowed" /></td>
                      <td className="py-2 px-1"><input type="number" min="0" value={line.totalCost} onChange={e => updateAllocLine(line.id, "totalCost", e.target.value)} className="w-full bg-blue-50 text-blue-800 border border-blue-300 rounded p-1.5 text-xs outline-none text-right font-bold focus:border-blue-500" /></td>
                      
                      {/* Delete */}
                      <td className="py-2 px-1 text-center"><button onClick={() => setAllocLines(prev => prev.filter(l => l.id !== line.id))} className="text-rose-500 hover:text-rose-400 font-bold">&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addAllocLine} className="mt-4 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">+ Add Row</button>
            </div>

            {/* ENHANCED BALANCER & ADJUSTMENTS */}
            <div className="border-t border-slate-800 flex flex-col lg:flex-row gap-0">
              
              {/* Adjustments Panel */}
              <div className="bg-[#0B1121] p-6 lg:w-1/3 border-r border-slate-800 space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Adjustments & Extra Costs</h3>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 flex items-center gap-2">Discount 
                    <button onClick={() => setDiscountType(t => t === "FLAT" ? "PERCENT" : "FLAT")} className="text-[10px] bg-[#131C2F] border border-slate-700 px-2 py-0.5 rounded font-bold hover:bg-slate-800">{discountType === "FLAT" ? "₨" : "%"}</button>
                  </span>
                  <input type="number" min="0" value={discountVal} onChange={e => setDiscountVal(e.target.value)} className="w-24 bg-white text-black rounded px-2 py-1 outline-none text-right focus:border-blue-500" />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Adjustment (+/-)</span>
                  <input type="number" value={adjustmentVal} onChange={e => setAdjustmentVal(e.target.value)} className="w-24 bg-white text-black rounded px-2 py-1 outline-none text-right focus:border-blue-500" />
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Delivery (Expensed)</span>
                  <input type="number" min="0" value={deliveryCharges} onChange={e => setDeliveryCharges(e.target.value)} className="w-24 bg-white text-black rounded px-2 py-1 outline-none text-right focus:border-blue-500" />
                </div>
                
                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Carton/Scrap Wt. (g)</span>
                  <input type="number" min="0" placeholder="e.g. 1500" value={cartonWeight} onChange={e => setCartonWeight(e.target.value)} className="w-24 bg-white text-black rounded px-2 py-1 outline-none text-right focus:border-blue-500" />
                </div>
                
                <button onClick={autoDistributeCosts} className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg py-2 text-xs font-bold uppercase tracking-widest transition">
                  Auto-Distribute Costs by Weight
                </button>
              </div>

              {/* Zero-Balance Summary */}
              <div className="bg-[#131C2F] p-6 lg:w-2/3 flex flex-col justify-between">
                <div className="flex flex-wrap justify-between items-end gap-4 bg-[#0B1121] p-4 rounded-xl border border-slate-800 mb-6">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Target Bill Total</div>
                    <div className="text-lg font-black text-white">{money(targetTotal)}</div>
                  </div>
                  <div className="text-slate-700 text-xl font-light">-</div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Items Subtotal</div>
                    <div className="text-lg font-black text-blue-400">{money(itemsSubtotal)}</div>
                  </div>
                  <div className="text-slate-700 text-xl font-light">+/-</div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">Adj. & Delivery</div>
                    <div className="text-lg font-black text-slate-300">{money(calcAdjustment + calcDelivery - calcDiscount)}</div>
                  </div>
                  <div className="text-slate-700 text-xl font-light">=</div>
                  <div className="bg-[#131C2F] px-4 py-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Unallocated Balance</div>
                    <div className={`text-xl font-black ${Math.abs(balanceRemaining) < 0.05 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {money(balanceRemaining)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => setAllocatingBill(null)} className="px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white bg-transparent hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700">Cancel</button>
                  <button onClick={submitAllocation} disabled={Math.abs(balanceRemaining) > 0.05} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-blue-500/20 transition">Finalize Adjustment</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.8); }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
