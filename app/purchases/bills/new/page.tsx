"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { Plus, Trash2, ArrowLeft, Layers, ShoppingBag, Calculator } from "lucide-react";
import ERPShell from "@/app/components/erp-shell";

type Supplier = { id: string; name: string; };
type Product = { id: string; name: string; sku?: string | null; };
type Warehouse = { id: string; name: string; };

type PurchaseLine = {
  id: string;
  productId: string;
  uom: "PIECES" | "KG";
  quantity: string;
  unitCost: string;
  discount: string;
  tax: string;
  warehouseId: string;
  description: string;
  batchNumber: string;
};

function makeLine(): PurchaseLine {
  return {
    id: `${Date.now()}-${Math.random()}`,
    productId: "",
    uom: "PIECES",
    quantity: "1",
    unitCost: "0",
    discount: "0",
    tax: "0",
    warehouseId: "",
    description: "",
    batchNumber: "",
  };
}

function formatAmount(value: number) {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewPurchaseBillPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [billDiscount, setBillDiscount] = useState("0");
  const [billTax, setBillTax] = useState("0");

  const [lines, setLines] = useState<PurchaseLine[]>([makeLine()]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");
        const [suppliersRes, productsRes, warehousesRes] = await Promise.all([ fetch("/api/suppliers"), fetch("/api/products"), fetch("/api/warehouses") ]);
        const suppliersData = await suppliersRes.json();
        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

        setSuppliers(suppliersData.suppliers || suppliersData.data || []);
        setProducts(productsData.products || productsData.data || []);
        setWarehouses(warehousesData.warehouses || warehousesData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchase data");
      } finally { setLoadingData(false); }
    }
    loadData();
  }, []);

  function updateLine(lineId: string, field: keyof PurchaseLine, value: string) {
    setLines((current) => current.map((line) => line.id === lineId ? { ...line, [field]: value } : line ));
  }

  function addLine() { setLines((current) => [...current, makeLine()]); }
  function removeLine(lineId: string) { setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== lineId)); }

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0), [lines]);
  const lineDiscount = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.discount) || 0), 0), [lines]);
  const lineTax = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.tax) || 0), 0), [lines]);
  const totalDiscount = lineDiscount + (Number(billDiscount) || 0);
  const totalTax = lineTax + (Number(billTax) || 0);
  const total = subtotal - totalDiscount + totalTax;

  function validateForm() {
    if (!supplierId) return "Please select a supplier.";
    if (!billDate) return "Please select a bill date.";
    if (lines.length === 0) return "Add at least one purchase item.";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId) return `Please select a product for item ${i + 1}.`;
      if (!line.warehouseId) return `Please select a warehouse for item ${i + 1}.`;
      const qty = Number(line.quantity);
      const cost = Number(line.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) return `Quantity must be greater than zero for item ${i + 1}.`;
      if (!Number.isFinite(cost) || cost < 0) return `Unit cost cannot be negative for item ${i + 1}.`;
    }
    return "";
  }

  async function saveBill(status: "DRAFT" | "POSTED") {
    const validationError = validateForm();
    if (validationError) { setError(validationError); toast.error(validationError); return; }

    try {
      setSaving(true);
      setError("");

      const payload = {
        supplierId,
        billNo: billNo.trim() || "AUTO",
        billDate,
        dueDate: dueDate || null,
        status,
        discount: Number(billDiscount) || 0,
        tax: Number(billTax) || 0,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          productId: line.productId,
          uom: line.uom,
          batchNumber: line.batchNumber.trim() || null,
          quantity: Number(line.quantity) || 0,
          unitCost: Number(line.unitCost) || 0,
          discount: Number(line.discount) || 0,
          tax: Number(line.tax) || 0,
          warehouseId: line.warehouseId,
          description: line.description.trim() || null,
        })),
      };

      const res = await fetch("/api/purchases/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save purchase bill");

      toast.success("Purchase bill saved successfully!");
      router.push("/purchases/bills");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save purchase bill";
      setError(msg);
      toast.error(msg);
    } finally { setSaving(false); }
  }

  if (loadingData) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans antialiased">
      <div className="text-teal-400 font-medium animate-pulse text-lg">Loading purchase module...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans antialiased relative overflow-hidden">
      
      {/* Ambient Glassmorphism Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <Toaster position="top-right" />
      <ERPShell title="New Purchase Bill">
        <div className="max-w-7xl mx-auto p-8 space-y-6 relative z-10">
          
          {/* Header */}
          <div className="flex justify-between items-center bg-gradient-to-r from-[#004e54]/80 to-[#009b9b]/80 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/10">
            <div>
              <p className="!text-teal-200 text-xs font-bold uppercase tracking-widest">Purchases / Bills / New</p>
              <h1 className="text-2xl font-bold !text-white tracking-tight mt-1 drop-shadow-sm">New Purchase Bill</h1>
              <p className="!text-teal-50 mt-1 text-sm opacity-90 drop-shadow-sm">Record a supplier purchase and optionally convert KGs into Grams.</p>
            </div>
            <button type="button" onClick={() => router.push("/purchases/bills")} className="bg-white/10 hover:bg-white/20 backdrop-blur-md !text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          {error && <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 backdrop-blur-md !text-rose-400 text-sm font-medium shadow-sm">{error}</div>}

          {/* Bill Details Section */}
          <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-zinc-950/30 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-teal-400" />
              <h2 className="text-lg font-bold !text-white tracking-tight">Bill Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                <span>Supplier *</span>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all shadow-inner">
                  <option value="" className="bg-zinc-900">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                <span>Supplier Bill No.</span>
                <input type="text" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Leave empty to auto-generate (PB-)" className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all placeholder-zinc-500 shadow-inner" />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                <span>Bill Date *</span>
                <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all shadow-inner" />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                <span>Due Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all shadow-inner" />
              </label>
            </div>
          </section>

          {/* Purchase Items Section */}
          <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-zinc-950/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <h2 className="text-lg font-bold !text-white tracking-tight">Purchase Items</h2>
              </div>
              <button type="button" onClick={addLine} className="bg-teal-600/80 hover:bg-teal-500 backdrop-blur-md !text-white border border-teal-500/50 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto p-6 custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider !text-zinc-400 font-semibold border-b border-white/5 pb-2">
                    {["Product", "Batch No.", "Buy In", "Qty", "Cost", "Disc.", "Tax", "Warehouse", "Total", ""].map((h) => (
                      <th key={h} className="pb-3 px-2 !text-zinc-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lines.map((line) => {
                    const quantity = Number(line.quantity) || 0;
                    const unitCost = Number(line.unitCost) || 0;
                    const discount = Number(line.discount) || 0;
                    const tax = Number(line.tax) || 0;
                    const lineTotal = quantity * unitCost - discount + tax;

                    return (
                      <tr key={line.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-2">
                          <select value={line.productId} onChange={(e) => updateLine(line.id, "productId", e.target.value)} className="w-[180px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none focus:border-teal-500/50 transition-colors shadow-inner">
                            <option value="" className="bg-zinc-900">Select...</option>
                            {products.map((p) => <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>)}
                          </select>
                        </td>

                        <td className="py-3 px-2">
                          <input type="text" value={line.batchNumber} onChange={(e) => updateLine(line.id, "batchNumber", e.target.value)} placeholder="Auto" className="w-[90px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none focus:border-teal-500/50 transition-colors shadow-inner" />
                        </td>

                        <td className="py-3 px-2">
                          <select value={line.uom} onChange={(e) => updateLine(line.id, "uom", e.target.value)} className="w-[100px] !bg-teal-500/10 backdrop-blur-sm border border-teal-500/30 !text-teal-300 p-2 rounded-lg text-xs font-bold outline-none focus:border-teal-500 transition-colors shadow-inner">
                            <option value="PIECES" className="bg-zinc-900 text-white">Pieces</option>
                            <option value="KG" className="bg-zinc-900 text-white">KGs</option>
                          </select>
                        </td>

                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} className="w-[80px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none text-center focus:border-teal-500/50 transition-colors shadow-inner" /></td>
                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.unitCost} onChange={(e) => updateLine(line.id, "unitCost", e.target.value)} className="w-[90px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500/50 transition-colors shadow-inner" /></td>
                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(line.id, "discount", e.target.value)} className="w-[80px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500/50 transition-colors shadow-inner" /></td>
                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.tax} onChange={(e) => updateLine(line.id, "tax", e.target.value)} className="w-[80px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500/50 transition-colors shadow-inner" /></td>
                        
                        <td className="py-3 px-2">
                          <select value={line.warehouseId} onChange={(e) => updateLine(line.id, "warehouseId", e.target.value)} className="w-[130px] !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white p-2 rounded-lg text-xs outline-none focus:border-teal-500/50 transition-colors shadow-inner">
                            <option value="" className="bg-zinc-900">Select...</option>
                            {warehouses.map((w) => <option key={w.id} value={w.id} className="bg-zinc-900">{w.name}</option>)}
                          </select>
                        </td>

                        <td className="py-3 px-2 text-right !text-teal-400 font-bold">{formatAmount(lineTotal)}</td>
                        
                        <td className="py-3 px-2 text-center">
                          <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1} className="text-zinc-500 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bill Totals Section */}
          <section className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-zinc-950/30 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-400" />
              <h2 className="text-lg font-bold !text-white tracking-tight">Bill Totals</h2>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                  <span>Bill Discount</span>
                  <input type="number" min="0" step="0.01" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all shadow-inner" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold !text-zinc-300">
                  <span>Bill Tax</span>
                  <input type="number" min="0" step="0.01" value={billTax} onChange={(e) => setBillTax(e.target.value)} className="w-full !bg-zinc-950/50 backdrop-blur-sm border border-white/10 !text-white px-4 py-2.5 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none transition-all shadow-inner" />
                </label>
              </div>

              <div className="bg-zinc-950/60 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-inner space-y-3">
                <div className="flex justify-between text-sm !text-zinc-400 border-b border-white/5 pb-3"><span>Subtotal</span><strong className="!text-white">PKR {formatAmount(subtotal)}</strong></div>
                <div className="flex justify-between text-sm !text-zinc-400 border-b border-white/5 pb-3"><span>Discount</span><strong className="!text-rose-400">- PKR {formatAmount(totalDiscount)}</strong></div>
                <div className="flex justify-between text-sm !text-zinc-400 border-b border-white/5 pb-3"><span>Tax</span><strong className="!text-teal-400">+ PKR {formatAmount(totalTax)}</strong></div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base font-bold !text-white">Grand Total</span>
                  <span className="text-2xl font-black !text-teal-400 drop-shadow-sm">PKR {formatAmount(total)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" disabled={saving} onClick={() => router.push("/purchases/bills")} className="px-6 py-2.5 text-sm font-semibold !text-zinc-400 hover:!text-white bg-transparent hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 backdrop-blur-sm">Cancel</button>
            <button type="button" disabled={saving} onClick={() => saveBill("DRAFT")} className="px-6 py-2.5 text-sm font-semibold !text-teal-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl backdrop-blur-md transition-all shadow-sm">{saving ? "Saving..." : "Save Draft"}</button>
            <button type="button" disabled={saving} onClick={() => saveBill("POSTED")} className="px-6 py-2.5 text-sm font-semibold !text-white !bg-teal-600/80 hover:!bg-teal-500 backdrop-blur-md border border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-[0_4px_12px_rgba(20,184,166,0.3)] transition-all">{saving ? "Saving..." : "Save & Post"}</button>
          </div>

        </div>
      </ERPShell>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
      `}} />
    </div>
  );
}
