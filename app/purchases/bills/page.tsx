"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";
import { Eye, Edit, Trash2, Undo2, LayoutGrid, RotateCcw } from "lucide-react";
import ERPShell from "@/app/components/erp-shell";

type PurchaseBill = {
  id: string; billNo: string; billDate: string;
  status: "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "VOID";
  total: number | string; balance: number | string; notes: string | null;
  supplier: { name: string; }; lines: any[];
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
  
  const [viewingBill, setViewingBill] = useState<PurchaseBill | null>(null);
  const [viewingAllocation, setViewingAllocation] = useState<any[] | null>(null);
  const [allocatingBill, setAllocatingBill] = useState<PurchaseBill | null>(null);

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
    if (!window.confirm("Undo this allocation? This will pull the generated items out of stock and restore your bulk purchase so you can re-allocate it.")) return;
    try {
      setActionLoading(billId);
      const res = await fetch(`/api/purchases/bills/allocate?billId=${billId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) { toast.success("Allocation Undone!"); loadBills(); }
      else toast.error(data.error || "Failed to undo.");
    } catch { toast.error("Action failed."); } finally { setActionLoading(null); }
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
                  {bills.map((bill) => {
                    const isRepackaged = bill.notes?.includes("[REPACKAGED]");
                    return (
                    <tr key={bill.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="p-4 font-bold text-white transition-colors">
                        {bill.billNo}
                        {isRepackaged && <span className="ml-2 text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest border border-purple-500/30">Repackaged</span>}
                      </td>
                      <td className="p-4 text-slate-400 transition-colors">{new Date(bill.billDate).toISOString().slice(0, 10)}</td>
                      <td className="p-4 text-blue-400 transition-colors font-semibold">{bill.supplier?.name}</td>
                      <td className="p-4 text-right font-bold text-slate-200 transition-colors">{money(bill.total)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-widest ${bill.status === "POSTED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>{bill.status}</span>
                      </td>
                      <td className="p-4 flex justify-center items-center gap-3">
                        <button onClick={() => setViewingBill(bill)} className="text-slate-400 hover:text-blue-400 transition" title="View Bill"><Eye className="w-4 h-4" /></button>
                        
                        {bill.status === "DRAFT" && (
                          <>
                            <button onClick={() => toast.error("Create an edit page under /purchases/bills/edit/[id] to use this.")} className="text-slate-400 hover:text-amber-400 transition" title="Edit Bill"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleAction(bill.id, "DELETE")} className="text-slate-400 hover:text-rose-500 transition" title="Delete Draft"><Trash2 className="w-4 h-4" /></button>
                            <button onClick={() => handleAction(bill.id, "POST")} className="text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded font-bold uppercase transition">Post</button>
                          </>
                        )}
                        
                        {bill.status === "POSTED" && !isRepackaged && (
                          <>
                            <button onClick={() => setAllocatingBill(bill)} className="text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-1 rounded font-bold uppercase transition">Allocate</button>
                            <button onClick={() => handleAction(bill.id, "REVERSE")} className="text-slate-400 hover:text-rose-500 transition" title="Reverse Bill"><RotateCcw className="w-4 h-4" /></button>
                          </>
                        )}
                        
                        {bill.status === "POSTED" && isRepackaged && (
                          <>
                            <button onClick={() => openAllocationDetails(bill.id)} className="text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-2 py-1 rounded font-bold uppercase transition flex items-center gap-1"><LayoutGrid className="w-3 h-3"/> View</button>
                            <button onClick={() => undoAllocation(bill.id)} className="text-slate-400 hover:text-amber-500 transition" title="Undo Allocation"><Undo2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ERPShell>

      {/* VIEW BILL MODAL */}
      {viewingBill && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131C2F] border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-6">
            <div className="flex justify-between items-start mb-6">
              <div><h2 className="text-xl font-bold text-white">Purchase Bill {viewingBill.billNo}</h2><p className="text-slate-400 text-sm mt-1">{viewingBill.supplier?.name} • {new Date(viewingBill.billDate).toLocaleDateString()}</p></div>
              <button onClick={() => setViewingBill(null)} className="text-slate-500 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="bg-[#0B1121] rounded-lg border border-slate-800 p-4">
              <div className="flex justify-between text-sm text-slate-400 mb-2 border-b border-slate-800 pb-2"><span>Status</span><strong className="text-white">{viewingBill.status}</strong></div>
              <div className="flex justify-between text-sm text-slate-400 mb-2 border-b border-slate-800 pb-2"><span>Total</span><strong className="text-emerald-400">{money(viewingBill.total)}</strong></div>
              <div className="flex justify-between text-sm text-slate-400"><span>Notes</span><span className="text-white">{viewingBill.notes || "None"}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ALLOCATION DETAILS MODAL */}
      {viewingAllocation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#131C2F] border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-6">
            <div className="flex justify-between items-start mb-6">
              <div><h2 className="text-xl font-bold text-white">Allocation Details</h2><p className="text-blue-400 text-sm mt-1 font-bold uppercase tracking-widest">Items generated from this bill</p></div>
              <button onClick={() => setViewingAllocation(null)} className="text-slate-500 hover:text-white text-2xl">&times;</button>
            </div>
            <table className="w-full text-left text-sm bg-[#0B1121] rounded-lg overflow-hidden border border-slate-800">
              <thead className="text-slate-400 text-[10px] uppercase border-b border-slate-800"><tr><th className="p-3">Product</th><th className="p-3 text-center">Qty Generated</th><th className="p-3 text-right">Assigned Cost</th><th className="p-3 text-right">Total Value</th></tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {viewingAllocation.map((mov, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 text-slate-200">
                    <td className="p-3 font-semibold">{mov.product?.name} <span className="block text-[10px] text-slate-500">{mov.product?.category?.name} • {mov.product?.brand?.name}</span></td>
                    <td className="p-3 text-center font-bold text-white">{mov.quantity}</td>
                    <td className="p-3 text-right">{money(mov.unitCost)}</td>
                    <td className="p-3 text-right text-blue-400 font-bold">{money(mov.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ... KEEP YOUR EXISTING ALLOCATION MODAL HERE (Unchanged) ... */}

    </div>
  );
}
