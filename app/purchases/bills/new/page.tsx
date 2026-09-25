"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import { Plus, Trash2, ArrowLeft, Layers, ShoppingBag, Calculator } from "lucide-react";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";

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

export default function NewPurchaseBillPage() {
  const router = useRouter();
  const { config: purchaseConfig, formatAmount, currency } = useERPConfig("purchases");

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
        const [suppliersRes, productsRes, warehousesRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/products"),
          fetch("/api/warehouses")
        ]);
        const suppliersData = await suppliersRes.json();
        const productsData = await productsRes.json();
        const warehousesData = await warehousesRes.json();

        setSuppliers(suppliersData.suppliers || suppliersData.data || []);
        setProducts(productsData.products || productsData.data || []);
        setWarehouses(warehousesData.warehouses || warehousesData.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load purchase data");
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  function updateLine(lineId: string, field: keyof PurchaseLine, value: string) {
    setLines((current) => current.map((line) => line.id === lineId ? { ...line, [field]: value } : line ));
  }

  function addLine() { setLines((current) => [...current, makeLine()]); }
  function removeLine(lineId: string) { setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== lineId)); }

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0), [lines]);
  const lineDiscount = useMemo(() => purchaseConfig.allowDiscounts ? lines.reduce((sum, line) => sum + (Number(line.discount) || 0), 0) : 0, [lines, purchaseConfig.allowDiscounts]);
  const lineTax = useMemo(() => purchaseConfig.allowTax ? lines.reduce((sum, line) => sum + (Number(line.tax) || 0), 0) : 0, [lines, purchaseConfig.allowTax]);
  const totalDiscount = lineDiscount + (purchaseConfig.allowDiscounts ? (Number(billDiscount) || 0) : 0);
  const totalTax = lineTax + (purchaseConfig.allowTax ? (Number(billTax) || 0) : 0);
  const total = subtotal - totalDiscount + totalTax;

  function validateForm() {
    if (purchaseConfig.requireSupplier && !supplierId) return "Please select a supplier.";
    if (!billDate) return "Please select a bill date.";
    if (lines.length === 0) return "Add at least one purchase item.";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.productId) return `Please select a product for item ${i + 1}.`;
      
      // Only validate warehouse if the setting is enabled
      if (purchaseConfig.requireWarehouse && !line.warehouseId) return `Please select a warehouse for item ${i + 1}.`;
      
      // Only validate batch if the setting is enabled
      if (purchaseConfig.requireBatch && !line.batchNumber.trim()) return `Batch number is required for item ${i + 1}.`;
      
      const qty = Number(line.quantity);
      const cost = Number(line.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) return `Quantity must be greater than zero for item ${i + 1}.`;
      if (!Number.isFinite(cost) || cost < 0) return `Unit cost cannot be negative for item ${i + 1}.`;
    }
    return "";
  }

  async function saveBill(statusOverride?: "DRAFT" | "POSTED") {
    const validationError = validateForm();
    if (validationError) { setError(validationError); toast.error(validationError); return; }

    const finalStatus = statusOverride || purchaseConfig.defaultBillStatus || "DRAFT";

    try {
      setSaving(true);
      setError("");

      const payload = {
        supplierId,
        billNo: billNo.trim() || "AUTO",
        billDate,
        dueDate: dueDate || null,
        status: finalStatus,
        discount: purchaseConfig.allowDiscounts ? Number(billDiscount) || 0 : 0,
        tax: purchaseConfig.allowTax ? Number(billTax) || 0 : 0,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          productId: line.productId,
          uom: line.uom,
          batchNumber: line.batchNumber.trim() || null,
          quantity: Number(line.quantity) || 0,
          unitCost: Number(line.unitCost) || 0,
          discount: purchaseConfig.allowDiscounts ? Number(line.discount) || 0 : 0,
          tax: purchaseConfig.allowTax ? Number(line.tax) || 0 : 0,
          // If disabled, silently inject the first available warehouse to satisfy the database
          warehouseId: purchaseConfig.requireWarehouse ? line.warehouseId : (warehouses[0]?.id || ""),
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center font-sans">
      <div className="text-teal-500 font-medium animate-pulse text-lg">Loading purchase module...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-300 font-sans antialiased relative overflow-hidden transition-colors">
      <Toaster position="top-right" />
      <ERPShell title="New Purchase Bill">
        <div className="max-w-7xl mx-auto p-8 space-y-6 relative z-10">
          
          <div className="flex justify-between items-center bg-gradient-to-r from-[#004e54]/90 to-[#009b9b]/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/10 text-white">
            <div>
              <p className="text-teal-200 text-xs font-bold uppercase tracking-widest">Purchases / Bills / New</p>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-1">New Purchase Bill</h1>
              <p className="text-teal-50 mt-1 text-sm opacity-90">Record vendor procurement using active Settings policy.</p>
            </div>
            <button type="button" onClick={() => router.push("/purchases/bills")} className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>

          {error && <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-sm font-medium">{error}</div>}

          <section className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-teal-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bill Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                <span>Supplier {purchaseConfig.requireSupplier ? "*" : ""}</span>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                <span>Supplier Bill No.</span>
                <input type="text" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Leave empty for auto PB-#" className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500" />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                <span>Bill Date *</span>
                <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500" />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                <span>Due Date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500" />
              </label>
            </div>
          </section>

          <section className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Purchase Items</h2>
              </div>
              <button type="button" onClick={addLine} className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto p-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-200/60 dark:border-white/5 pb-2">
                    <th className="pb-3 px-2">Product</th>
                    {/* Conditionally render Batch column */}
                    {purchaseConfig.requireBatch && <th className="pb-3 px-2">Batch No. *</th>}
                    <th className="pb-3 px-2">UOM</th>
                    <th className="pb-3 px-2">Qty</th>
                    <th className="pb-3 px-2">Cost</th>
                    {purchaseConfig.allowDiscounts && <th className="pb-3 px-2">Disc.</th>}
                    {purchaseConfig.allowTax && <th className="pb-3 px-2">Tax</th>}
                    {/* Conditionally render Warehouse column */}
                    {purchaseConfig.requireWarehouse && <th className="pb-3 px-2">Warehouse *</th>}
                    <th className="pb-3 px-2 text-right">Total ({currency})</th>
                    <th className="pb-3 px-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {lines.map((line) => {
                    const qty = Number(line.quantity) || 0;
                    const cost = Number(line.unitCost) || 0;
                    const disc = purchaseConfig.allowDiscounts ? Number(line.discount) || 0 : 0;
                    const tax = purchaseConfig.allowTax ? Number(line.tax) || 0 : 0;
                    const lineTotal = qty * cost - disc + tax;

                    return (
                      <tr key={line.id}>
                        <td className="py-3 px-2">
                          <select value={line.productId} onChange={(e) => updateLine(line.id, "productId", e.target.value)} className="w-[180px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none">
                            <option value="">Select product...</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>

                        {/* Conditionally render Batch input */}
                        {purchaseConfig.requireBatch && (
                          <td className="py-3 px-2">
                            <input type="text" value={line.batchNumber} onChange={(e) => updateLine(line.id, "batchNumber", e.target.value)} placeholder="Required" className="w-[100px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-teal-500" />
                          </td>
                        )}

                        <td className="py-3 px-2">
                          <select value={line.uom} onChange={(e) => updateLine(line.id, "uom", e.target.value as any)} className="w-[90px] bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 p-2 rounded-lg text-xs font-bold outline-none">
                            <option value="PIECES">Pieces</option>
                            <option value="KG">KGs</option>
                          </select>
                        </td>

                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(line.id, "quantity", e.target.value)} className="w-[80px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none text-center focus:border-teal-500" /></td>
                        <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.unitCost} onChange={(e) => updateLine(line.id, "unitCost", e.target.value)} className="w-[90px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500" /></td>
                        
                        {purchaseConfig.allowDiscounts && (
                          <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.discount} onChange={(e) => updateLine(line.id, "discount", e.target.value)} className="w-[80px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500" /></td>
                        )}

                        {purchaseConfig.allowTax && (
                          <td className="py-3 px-2"><input type="number" min="0" step="0.01" value={line.tax} onChange={(e) => updateLine(line.id, "tax", e.target.value)} className="w-[80px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none text-right focus:border-teal-500" /></td>
                        )}

                        {/* Conditionally render Warehouse input */}
                        {purchaseConfig.requireWarehouse && (
                          <td className="py-3 px-2">
                            <select value={line.warehouseId} onChange={(e) => updateLine(line.id, "warehouseId", e.target.value)} className="w-[130px] bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-teal-500">
                              <option value="">Select warehouse...</option>
                              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </td>
                        )}

                        <td className="py-3 px-2 text-right text-teal-600 dark:text-teal-400 font-bold">{formatAmount(lineTotal)}</td>
                        
                        <td className="py-3 px-2 text-center">
                          <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1} className="text-slate-400 hover:text-rose-500 disabled:opacity-20 transition-colors">
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

          <section className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bill Totals</h2>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {purchaseConfig.allowDiscounts && (
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    <span>Bill Discount ({currency})</span>
                    <input type="number" min="0" step="0.01" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500" />
                  </label>
                )}
                {purchaseConfig.allowTax && (
                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    <span>Bill Tax ({currency})</span>
                    <input type="number" min="0" step="0.01" value={billTax} onChange={(e) => setBillTax(e.target.value)} className="w-full bg-white dark:bg-zinc-950/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl text-sm outline-none focus:border-teal-500" />
                  </label>
                )}
              </div>

              <div className="bg-slate-50/70 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 rounded-2xl p-6 space-y-3">
                <div className="flex justify-between text-sm text-slate-600 dark:text-zinc-400 border-b border-slate-200/60 dark:border-white/5 pb-3">
                  <span>Subtotal</span>
                  <strong className="text-slate-900 dark:text-white">{currency} {formatAmount(subtotal)}</strong>
                </div>
                {purchaseConfig.allowDiscounts && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-zinc-400 border-b border-slate-200/60 dark:border-white/5 pb-3">
                    <span>Discount</span>
                    <strong className="text-rose-500">- {currency} {formatAmount(totalDiscount)}</strong>
                  </div>
                )}
                {purchaseConfig.allowTax && (
                  <div className="flex justify-between text-sm text-slate-600 dark:text-zinc-400 border-b border-slate-200/60 dark:border-white/5 pb-3">
                    <span>Tax</span>
                    <strong className="text-teal-600 dark:text-teal-400">+ {currency} {formatAmount(totalTax)}</strong>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">Grand Total</span>
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400">{currency} {formatAmount(total)}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" disabled={saving} onClick={() => router.push("/purchases/bills")} className="px-6 py-2.5 text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors">Cancel</button>
            <button type="button" disabled={saving} onClick={() => saveBill("DRAFT")} className="px-6 py-2.5 text-sm font-semibold text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-white/5 border border-teal-200 dark:border-white/10 rounded-xl transition-all">Save Draft</button>
            <button type="button" disabled={saving} onClick={() => saveBill("POSTED")} className="px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-md transition-all">Save & Post</button>
          </div>

        </div>
      </ERPShell>
    </div>
  );
}
