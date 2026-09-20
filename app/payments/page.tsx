"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "expense" | "supplier" | "receive";

const options: Array<{ mode: Mode; title: string; description: string; color: string; icon: string; }> = [
  { mode: "expense", title: "Record Expense", description: "Record business expenses paid from cash or bank.", color: "#d97706", icon: "E" },
  { mode: "supplier", title: "Pay Supplier", description: "Pay suppliers against their outstanding bills.", color: "#2563eb", icon: "P" },
  { mode: "receive", title: "Receive Payment", description: "Receive customer payments against invoices.", color: "#16a34a", icon: "R" },
];

export default function PaymentsPage() {
  const router = useRouter();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  async function fetchInbox() {
    setLoading(true);
    const res = await fetch("/api/payments");
    const json = await res.json();
    if (json.ok) setVouchers(json.payments.filter((p: any) => p.status === "UNAPPROVED"));
    setLoading(false);
  }

  useEffect(() => { fetchInbox(); }, []);

  async function approveVoucher(id: string) {
    if (!confirm("Approve this voucher? It will be permanently posted to the General Ledger and Bank Directory.")) return;
    setApproving(id);
    await fetch("/api/payments/approve", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: id }) });
    setApproving(null);
    fetchInbox();
  }

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amt);

  return (
    <div className="dashboard max-w-5xl mx-auto p-6 space-y-8">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Payments & Transactions</p>
          <h1 className="text-3xl font-extrabold text-gray-900">Payments Workspace</h1>
          <p className="text-gray-500 mt-2">Choose the transaction you want to record.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16 }}>
        {options.map((option) => (
          <button key={option.mode} type="button" onClick={() => router.push(`/payments/${option.mode}`)}
            style={{ textAlign: "left", border: "1px solid #e5e9f0", background: "#fff", borderRadius: 14, padding: 22, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,.03)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${option.color}15`, color: option.color, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>{option.icon}</div>
            <div style={{ color: "#172033", fontSize: 16, fontWeight: 750 }}>{option.title}</div>
            <div style={{ color: "#667085", fontSize: 12, lineHeight: 1.6, marginTop: 7 }}>{option.description}</div>
            <div style={{ color: option.color, fontSize: 12, fontWeight: 750, marginTop: 20 }}>Open {option.title} &rarr;</div>
          </button>
        ))}
      </div>

      {/* NEW MANAGER INBOX */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-10">
        <div className="p-5 border-b border-amber-200 bg-amber-50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-amber-900">Manager Approval Inbox</h2>
            <p className="text-xs text-amber-700 mt-1">Review and approve draft vouchers. Unapproved vouchers do not affect accounting.</p>
          </div>
          <div className="bg-amber-200 text-amber-900 font-bold px-3 py-1 rounded-full text-xs shadow-sm">
            {vouchers.length} Action Required
          </div>
        </div>
        <table className="erp-data-table">
          <thead>
            <tr className="border-b bg-gray-50 text-[11px] uppercase text-gray-500 font-bold">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Voucher No</th>
              <th className="py-3 px-4">Details</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[13px]">
            {loading ? <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-semibold">Loading inbox...</td></tr> :
             vouchers.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-medium">All caught up! No vouchers require approval.</td></tr> :
             vouchers.map(v => (
               <tr key={v.id} className="hover:bg-amber-50/30 transition">
                 <td className="py-3 px-4 text-gray-600">{new Date(v.paymentDate).toISOString().slice(0, 10)}</td>
                 <td className="py-3 px-4 font-bold text-gray-900">{v.voucherNo}</td>
                 <td className="py-3 px-4 text-gray-700">{v.description || `${v.mode.toUpperCase()} - ${v.customerName || v.supplierName || v.accountName}`}</td>
                 <td className="py-3 px-4 text-right font-bold text-gray-900">{formatCurrency(v.amount)}</td>
                 <td className="py-3 px-4 text-center">
                   <button onClick={() => approveVoucher(v.id)} disabled={approving === v.id} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded shadow-sm text-xs transition disabled:opacity-50">
                     {approving === v.id ? "Posting..." : "âœ“ Approve"}
                   </button>
                 </td>
               </tr>
             ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}