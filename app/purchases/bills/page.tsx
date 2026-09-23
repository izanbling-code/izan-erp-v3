"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  isNew: boolean;
  productId: string;
  name: string;
  categoryId: string;
  brandId: string;
  unitId: string;
  batchNo: string;
  yieldQty: number | string;
  weightGrams: number | string;
  totalCost: number | string;
};

function money(amount: number | string) {
  return `Rs ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Allocation Modal State
  const [allocatingBill, setAllocatingBill] = useState<PurchaseBill | null>(null);
  const [allocLines, setAllocLines] = useState<AllocationLine[]>([]);
  const [cartonWeight, setCartonWeight] = useState<number | string>("");
  
  // Master Data for Auto-Create Dropdowns
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  async function loadBills() {
    try {
      setLoading(true); setError("");
      const res = await fetch(`/api/purchases/bills?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (data.ok) setBills(data.bills || []);
      else setError(data.error || "Failed to load purchase bills");
    } catch { setError("Failed to connect to the server."); } 
    finally { setLoading(false); }
  }

  useEffect(() => { loadBills(); }, []);

  // Fetch Master Data when Allocation Modal Opens
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
      setActionLoading(id); setError(""); setSuccess("");
      const res = await fetch("/api/purchases/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await res.json();
      if (data.ok) { setSuccess(`Bill successfully updated.`); loadBills(); }
      else setError(data.error || "Action failed.");
    } catch { setError("Failed to execute action."); } 
    finally { setActionLoading(null); }
  }

  // ALLOCATION ENGINE LOGIC
  function openAllocation(bill: PurchaseBill) {
    setAllocatingBill(bill);
    setAllocLines([{ id: Math.random().toString(), isNew: false, productId: "", name: "", categoryId: "", brandId: "", unitId: "", batchNo: "", yieldQty: "", weightGrams: "", totalCost: "" }]);
    setCartonWeight("");
  }

  function addAllocLine() {
    setAllocLines(prev => [...prev, { id: Math.random().toString(), isNew: false, productId: "", name: "", categoryId: "", brandId: "", unitId: "", batchNo: "", yieldQty: "", weightGrams: "", totalCost: "" }]);
  }

  function updateAllocLine(id: string, field: keyof AllocationLine, val: any) {
    setAllocLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      // Smart Auto-Create Toggle
      if (field === "productId") {
        if (val === "NEW") { updated.isNew = true; updated.productId = ""; updated.name = ""; } 
        else { updated.isNew = false; updated.name = ""; }
      }
      return updated;
    }));
  }

  function autoDistributeCosts() {
    const totalWeight = allocLines.reduce((sum, l) => sum + (Number(l.weightGrams) || 0), 0);
    if (totalWeight <= 0) return alert("Please enter weights for your items first!");
    
    const targetTotal = allocatingBill?.total || 0;
    
    setAllocLines(prev => prev.map(l => {
      const weight = Number(l.weightGrams) || 0;
      const proportion = weight / totalWeight;
      return { ...l, totalCost: (targetTotal * proportion).toFixed(2) };
    }));
  }

  const allocatedTotal = useMemo(() => allocLines.reduce((sum, l) => sum + (Number(l.totalCost) || 0), 0), [allocLines]);
  const balanceRemaining = (allocatingBill?.total || 0) - allocatedTotal;

  async function submitAllocation() {
    if (Math.abs(balanceRemaining) > 0.05) return alert("Balance must be exactly Rs 0.00 before finalizing!");
    // We will hook this up to the backend API in the next step!
    alert("Allocation Payload Ready! Backend connection coming next.");
  }

  return (
    <ERPShell title="Purchase Bills">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Bills</h1>
            <p className="text-xs text-gray-500 mt-1">Manage vendor procurement, batch receiving, and stock allocation.</p>
          </div>
          <Link href="/purchases/bills/new" className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition">+ Create Bill</Link>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>}
        {success && <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">{success}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex gap-3">
            <input type="text" placeholder="Search by Bill # or Supplier..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadBills()} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-500 w-72" />
            <button onClick={loadBills} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-lg text-gray-700 transition">Search</button>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-data-table w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-sm">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-bold text-gray-800">{bill.billNo}</td>
                    <td className="py-3 px-4 text-gray-500">{new Date(bill.billDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-700">{bill.supplier?.name}</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{money(bill.total)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${bill.status === "POSTED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{bill.status}</span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {bill.status === "DRAFT" && (
                        <button onClick={() => handleAction(bill.id, "POST")} disabled={actionLoading === bill.id} className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[11px] font-semibold transition">Post</button>
                      )}
                      {bill.status === "POSTED" && (
                        <>
                          <button onClick={() => openAllocation(bill)} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold transition shadow-sm">Allocate Stock</button>
                          <button onClick={() => handleAction(bill.id, "REVERSE")} disabled={actionLoading === bill.id} className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-semibold transition">Reverse</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ZERO-BALANCE ALLOCATION MODAL */}
      {allocatingBill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Stock Allocation & Break-Down</h2>
                <p className="text-xs text-gray-500 font-semibold mt-1">Bill {allocatingBill.billNo} • Target Balance: {money(allocatingBill.total)}</p>
              </div>
              <button onClick={() => setAllocatingBill(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
                    <th className="pb-3 w-56">Item Name</th>
                    <th className="pb-3 w-24">Batch</th>
                    <th className="pb-3 w-32">Category</th>
                    <th className="pb-3 w-28">Brand</th>
                    <th className="pb-3 w-24">Unit</th>
                    <th className="pb-3 w-24 text-right">Yield Qty</th>
                    <th className="pb-3 w-24 text-right">Weight (g)</th>
                    <th className="pb-3 w-32 text-right">Total Cost</th>
                    <th className="pb-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allocLines.map((line, idx) => (
                    <tr key={line.id}>
                      <td className="py-3 pr-2">
                        {line.isNew ? (
                          <div className="flex gap-1">
                            <input type="text" placeholder="Type new item name..." value={line.name} onChange={e => updateAllocLine(line.id, "name", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none focus:border-purple-500 bg-purple-50" autoFocus />
                            <button onClick={() => updateAllocLine(line.id, "productId", "")} className="text-xs text-red-500 font-bold px-1">&times;</button>
                          </div>
                        ) : (
                          <select value={line.productId} onChange={e => updateAllocLine(line.id, "productId", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none focus:border-purple-500">
                            <option value="">Select Item...</option>
                            <option value="NEW" className="font-bold text-purple-600">+ Create New Item</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="py-3 pr-2"><input type="text" placeholder="Auto" value={line.batchNo} onChange={e => updateAllocLine(line.id, "batchNo", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none focus:border-purple-500" /></td>
                      <td className="py-3 pr-2">
                        <select value={line.categoryId} onChange={e => updateAllocLine(line.id, "categoryId", e.target.value)} disabled={!line.isNew} className="w-full border rounded p-1.5 text-xs outline-none disabled:bg-gray-50">
                          <option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="py-3 pr-2">
                        <select value={line.brandId} onChange={e => updateAllocLine(line.id, "brandId", e.target.value)} disabled={!line.isNew} className="w-full border rounded p-1.5 text-xs outline-none disabled:bg-gray-50">
                          <option value="">Select...</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </td>
                      <td className="py-3 pr-2">
                        <select value={line.unitId} onChange={e => updateAllocLine(line.id, "unitId", e.target.value)} disabled={!line.isNew} className="w-full border rounded p-1.5 text-xs outline-none disabled:bg-gray-50">
                          <option value="">Select...</option>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </td>
                      <td className="py-3 pr-2"><input type="number" min="0" value={line.yieldQty} onChange={e => updateAllocLine(line.id, "yieldQty", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none text-right focus:border-purple-500" placeholder="Qty" /></td>
                      <td className="py-3 pr-2"><input type="number" min="0" value={line.weightGrams} onChange={e => updateAllocLine(line.id, "weightGrams", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none text-right focus:border-purple-500" placeholder="Grams" /></td>
                      <td className="py-3 pr-2"><input type="number" min="0" value={line.totalCost} onChange={e => updateAllocLine(line.id, "totalCost", e.target.value)} className="w-full border rounded p-1.5 text-xs outline-none text-right font-bold text-purple-700 bg-purple-50" placeholder="Rs" /></td>
                      <td className="py-3 text-center"><button onClick={() => setAllocLines(prev => prev.filter(l => l.id !== line.id))} className="text-red-400 hover:text-red-600 font-bold">&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addAllocLine} className="mt-4 text-xs font-bold text-purple-600 hover:text-purple-800">+ Add Row</button>
            </div>

            {/* RECONCILIATION BALANCER */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="flex items-center gap-4">
                <div className="text-xs font-bold text-gray-500 uppercase">Carton/Scrap Wt. (g)</div>
                <input type="number" placeholder="e.g. 1500" value={cartonWeight} onChange={e => setCartonWeight(e.target.value)} className="w-24 border rounded p-1.5 text-xs text-right outline-none" />
                <button onClick={autoDistributeCosts} className="ml-2 bg-gray-800 hover:bg-black text-white px-4 py-1.5 rounded text-xs font-bold shadow transition">Auto-Distribute Costs by Weight</button>
              </div>

              <div className="flex gap-6 items-center bg-white border rounded-xl p-3 shadow-sm">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-gray-400">Bill Total</div>
                  <div className="text-sm font-black text-gray-800">{money(allocatingBill.total)}</div>
                </div>
                <div className="text-2xl font-light text-gray-300">-</div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-gray-400">Allocated</div>
                  <div className="text-sm font-black text-purple-600">{money(allocatedTotal)}</div>
                </div>
                <div className="text-2xl font-light text-gray-300">=</div>
                <div className="text-right bg-gray-50 px-3 py-1 rounded">
                  <div className="text-[10px] font-bold uppercase text-gray-400">Balance</div>
                  <div className={`text-lg font-black ${Math.abs(balanceRemaining) < 0.05 ? 'text-green-500' : 'text-red-500'}`}>
                    {money(balanceRemaining)}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setAllocatingBill(null)} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                <button onClick={submitAllocation} disabled={Math.abs(balanceRemaining) > 0.05} className="px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg transition">Finalize Adjustment</button>
              </div>

            </div>
          </div>
        </div>
      )}
    </ERPShell>
  );
}
