"use client";
import { useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", border: "1px solid #e5e9f0",
  borderRadius: "10px", background: "#fff", color: "#172033",
  fontSize: "14px", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "7px",
  fontSize: "13px", fontWeight: 600, color: "#374151",
};

export default function PayablesDashboard() {
  const [activeTab, setActiveTab] = useState<"expenses" | "payments">("expenses");
  const [data, setData] = useState<{ expenses: any[], payments: any[], accounts: any[], suppliers: any[] }>({ expenses: [], payments: [], accounts: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [expForm, setExpForm] = useState({ accountId: "", amount: "", date: new Date().toISOString().slice(0,10), paymentMethod: "CASH", paymentAccountId: "", referenceNo: "", notes: "" });
  const [payForm, setPayForm] = useState({ supplierId: "", amount: "", date: new Date().toISOString().slice(0,10), method: "BANK_TRANSFER", accountId: "", referenceNo: "", notes: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases/payables");
      const j = await res.json();
      if (j.ok) setData(j); else toast.error(j.error);
    } catch (e) { toast.error("System Error"); } finally { setLoading(false); }
  }

  // --- GL Account Filtering Logic ---
  const expenseAccounts = data.accounts.filter((a: any) => a.type === "EXPENSE");
  const cashAccounts = data.accounts.filter((a: any) => a.type === "CASH" || a.name.toUpperCase().includes("CASH"));
  const bankAccounts = data.accounts.filter((a: any) => (a.type === "BANK" || a.type === "ASSET") && !a.name.toUpperCase().includes("CASH"));

  // Dynamic Auto-Select Handlers
  const handleExpMethodChange = (e: any) => {
    const method = e.target.value;
    const autoAccount = method === "CASH" ? (cashAccounts[0]?.id || "") : "";
    setExpForm({ ...expForm, paymentMethod: method, paymentAccountId: autoAccount, referenceNo: "" });
  };

  const handlePayMethodChange = (e: any) => {
    const method = e.target.value;
    const autoAccount = method === "CASH" ? (cashAccounts[0]?.id || "") : "";
    setPayForm({ ...payForm, method, accountId: autoAccount, referenceNo: "" });
  };

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expForm.accountId || !expForm.amount) return toast.error("Account and Amount required");
    if (expForm.paymentMethod === "CHECK" && !expForm.referenceNo) return toast.error("Check Number is required");
    
    setBusy(true);
    try {
      const res = await fetch("/api/purchases/payables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_EXPENSE", ...expForm }) });
      const j = await res.json();
      if (j.ok) { toast.success("Draft created"); setShowExpenseForm(false); loadData(); } else toast.error(j.error);
    } catch (e) { toast.error("Error saving"); } finally { setBusy(false); }
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payForm.supplierId || !payForm.amount || !payForm.accountId) return toast.error("Supplier, Bank/Cash Account, and Amount required");
    if (payForm.method === "CHECK" && !payForm.referenceNo) return toast.error("Check Number is required");

    setBusy(true);
    try {
      const res = await fetch("/api/purchases/payables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_PAYMENT", ...payForm }) });
      const j = await res.json();
      if (j.ok) { toast.success("Draft created"); setShowPaymentForm(false); loadData(); } else toast.error(j.error);
    } catch (e) { toast.error("Error saving"); } finally { setBusy(false); }
  }

  async function updateStatus(id: string, type: "EXPENSE" | "PAYMENT", status: string) {
    if (!window.confirm(`Move this record to ${status.replace("_", " ")}?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/purchases/payables", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type, status }) });
      const j = await res.json();
      if (j.ok) { toast.success(j.message); loadData(); } else toast.error(j.error);
    } catch (e) { toast.error("Update failed"); } finally { setBusy(false); }
  }

  const formatMoney = (v: any) => `₨ ${Number(v).toLocaleString(undefined, {minimumFractionDigits: 2})}`;

  const StatusBadge = ({ status }: { status: string }) => {
    const isDraft = status === "DRAFT";
    const isPending = status === "PENDING_APPROVAL";
    const isApproved = status === "APPROVED";
    return (
      <span style={{
        display: "inline-block", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
        background: isDraft ? "#f3f4f6" : isPending ? "#fef3c7" : isApproved ? "#dbeafe" : "#dcfce7",
        color: isDraft ? "#4b5563" : isPending ? "#b45309" : isApproved ? "#1d4ed8" : "#15803d",
      }}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="dashboard">
      <Toaster position="top-right" />
      
      <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "20px", marginBottom: "20px" }}>
        <div>
          <p className="eyebrow" style={{ fontSize: "11px", fontWeight: 800, color: "#6b7280", letterSpacing: "0.08em", marginBottom: "8px" }}>TREASURY & SPEND</p>
          <h1 className="dashboard-title" style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>Payables Dashboard</h1>
          <p className="dashboard-description" style={{ margin: "6px 0 0", fontSize: "14px", color: "#6b7280" }}>Manage direct expenses and supplier disbursements.</p>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button data-shortcut="e" onClick={() => { setExpForm({...expForm, amount: "", referenceNo: "", notes: "", paymentMethod: "CASH", paymentAccountId: cashAccounts[0]?.id || ""}); setShowExpenseForm(true); }} style={{ height: "44px", padding: "0 20px", borderRadius: "10px", border: "1px solid #d9dee8", background: "#ffffff", color: "#172033", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)" }}>
            + Direct Expense
          </button>
          <button data-shortcut="p" onClick={() => { setPayForm({...payForm, amount: "", referenceNo: "", notes: "", method: "BANK_TRANSFER", accountId: ""}); setShowPaymentForm(true); }} style={{ height: "44px", padding: "0 20px", borderRadius: "10px", border: "none", background: "#2563eb", color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px rgba(16, 24, 40, 0.08)" }}>
            + Supplier Payment
          </button>
        </div>
      </div>

      <div className="dashboard-panel" style={{ padding: 0, overflow: "hidden", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", background: "#fbfcfe", borderBottom: "1px solid #e5e9f0", padding: "12px 24px", gap: "12px" }}>
          <button onClick={() => setActiveTab("expenses")} style={{ padding: "8px 16px", borderRadius: "8px", border: activeTab === "expenses" ? "1px solid #d9dee8" : "1px solid transparent", background: activeTab === "expenses" ? "#ffffff" : "transparent", color: activeTab === "expenses" ? "#111827" : "#64748b", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: activeTab === "expenses" ? "0 1px 2px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>Direct Expenses</button>
          <button onClick={() => setActiveTab("payments")} style={{ padding: "8px 16px", borderRadius: "8px", border: activeTab === "payments" ? "1px solid #d9dee8" : "1px solid transparent", background: activeTab === "payments" ? "#ffffff" : "transparent", color: activeTab === "payments" ? "#111827" : "#64748b", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: activeTab === "payments" ? "0 1px 2px rgba(0,0,0,0.05)" : "none", transition: "all 0.2s" }}>Supplier Payments</button>
        </div>

        {loading ? (
          <div style={{ padding: "50px 24px", textAlign: "center", color: "#6b7280", fontWeight: 600 }}>Loading Ledger...</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="erp-data-table">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e9f0", background: "#fbfcfe" }}>
                  {["Voucher #", "Date", activeTab === "expenses" ? "GL Account" : "Supplier", "Method", "Amount", "Status", "Workflow Actions"].map((h, i) => (
                    <th key={h} >{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(activeTab === "expenses" ? data.expenses : data.payments).map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #eef1f5" }}>
                    <td >
                      {item.voucherNumber || item.paymentNumber}
                      {item.referenceNo && <span style={{ display: "block", fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Ref: {item.referenceNo}</span>}
                    </td>
                    <td >{new Date(item.date).toISOString().slice(0,10)}</td>
                    <td >{activeTab === "expenses" ? data.accounts.find((a:any) => a.id === item.accountId)?.name : data.suppliers.find((s:any) => s.id === item.supplierId)?.name}</td>
                    <td >{(item.paymentMethod || item.method).replace("_", " ")}</td>
                    <td >{formatMoney(item.amount)}</td>
                    <td ><StatusBadge status={item.status} /></td>
                    <td >
                      {item.status === "DRAFT" && <button onClick={() => updateStatus(item.id, activeTab === "expenses" ? "EXPENSE" : "PAYMENT", "PENDING_APPROVAL")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #fcd34d", background: "#fffbeb", color: "#b45309", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Submit</button>}
                      {item.status === "PENDING_APPROVAL" && <button onClick={() => updateStatus(item.id, activeTab === "expenses" ? "EXPENSE" : "PAYMENT", "APPROVED")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Approve</button>}
                      {item.status === "APPROVED" && <button onClick={() => updateStatus(item.id, activeTab === "expenses" ? "EXPENSE" : "PAYMENT", "POSTED")} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>Post to GL</button>}
                    </td>
                  </tr>
                ))}
                {(activeTab === "expenses" ? data.expenses : data.payments).length === 0 && (
                  <tr><td colSpan={7} >No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showExpenseForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onMouseDown={(e) => { if(e.target === e.currentTarget) setShowExpenseForm(false); }}>
          <div style={{ width: "100%", maxWidth: 650, background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fbfcfe" }}>
              <h2 style={{ margin: 0, color: "#172033", fontSize: 18, fontWeight: 800 }}>Record Direct Expense</h2>
              <button type="button" onClick={() => setShowExpenseForm(false)} style={{ border: 0, background: "transparent", color: "#6b7280", fontSize: 24, cursor: "pointer" }}>&times;</button>
            </div>
            <form onSubmit={saveExpense}>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <label style={labelStyle}>Expense Account *<select value={expForm.accountId} onChange={e=>setExpForm({...expForm, accountId: e.target.value})} style={inputStyle}><option value="">Select Account...</option>{expenseAccounts.map((a:any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <label style={labelStyle}>Amount (₨) *<input type="number" step="0.01" value={expForm.amount} onChange={e=>setExpForm({...expForm, amount: e.target.value})} style={inputStyle} /></label>
                  <label style={labelStyle}>Date *<input type="date" value={expForm.date} onChange={e=>setExpForm({...expForm, date: e.target.value})} style={inputStyle} /></label>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: expForm.paymentMethod === "CHECK" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 18 }}>
                  <label style={labelStyle}>Payment Method *
                    <select value={expForm.paymentMethod} onChange={handleExpMethodChange} style={inputStyle}>
                      <option value="CASH">Cash Book</option>
                      <option value="BANK_TRANSFER">Online Transfer</option>
                      <option value="CHECK">Check (Chq)</option>
                    </select>
                  </label>
                  <label style={labelStyle}>Paid From (Asset) *
                    <select value={expForm.paymentAccountId} onChange={e=>setExpForm({...expForm, paymentAccountId: e.target.value})} style={inputStyle}>
                      <option value="">Select Account...</option>
                      {(expForm.paymentMethod === "CASH" ? cashAccounts : bankAccounts).map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                  {expForm.paymentMethod === "CHECK" && (
                    <label style={labelStyle}>Check No. *
                      <input type="text" value={expForm.referenceNo} onChange={e=>setExpForm({...expForm, referenceNo: e.target.value})} style={inputStyle} placeholder="Chq #..." />
                    </label>
                  )}
                </div>

                <label style={labelStyle}>Notes / Description<textarea value={expForm.notes} onChange={e=>setExpForm({...expForm, notes: e.target.value})} style={{...inputStyle, height: "80px", resize: "vertical"}}></textarea></label>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e9f0", display: "flex", justifyContent: "flex-end", gap: 10, background: "#fbfcfe" }}>
                <button type="button" onClick={() => setShowExpenseForm(false)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #e5e9f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={busy} style={{ padding: "10px 18px", borderRadius: 9, border: 0, background: busy ? "#93c5fd" : "#111827", color: "#fff", fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>{busy ? "Saving..." : "Save Draft"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onMouseDown={(e) => { if(e.target === e.currentTarget) setShowPaymentForm(false); }}>
          <div style={{ width: "100%", maxWidth: 650, background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.18)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fbfcfe" }}>
              <h2 style={{ margin: 0, color: "#172033", fontSize: 18, fontWeight: 800 }}>Disburse Supplier Payment</h2>
              <button type="button" onClick={() => setShowPaymentForm(false)} style={{ border: 0, background: "transparent", color: "#6b7280", fontSize: 24, cursor: "pointer" }}>&times;</button>
            </div>
            <form onSubmit={savePayment}>
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <label style={labelStyle}>Supplier *<select value={payForm.supplierId} onChange={e=>setPayForm({...payForm, supplierId: e.target.value})} style={inputStyle}><option value="">Select Supplier...</option>{data.suppliers.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <label style={labelStyle}>Amount (₨) *<input type="number" step="0.01" value={payForm.amount} onChange={e=>setPayForm({...payForm, amount: e.target.value})} style={inputStyle} /></label>
                  <label style={labelStyle}>Date *<input type="date" value={payForm.date} onChange={e=>setPayForm({...payForm, date: e.target.value})} style={inputStyle} /></label>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: payForm.method === "CHECK" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 18 }}>
                  <label style={labelStyle}>Disbursement Method *
                    <select value={payForm.method} onChange={handlePayMethodChange} style={inputStyle}>
                      <option value="BANK_TRANSFER">Online Transfer</option>
                      <option value="CASH">Cash Book</option>
                      <option value="CHECK">Check (Chq)</option>
                    </select>
                  </label>
                  <label style={labelStyle}>Paid From (Asset) *
                    <select value={payForm.accountId} onChange={e=>setPayForm({...payForm, accountId: e.target.value})} style={inputStyle}>
                      <option value="">Select Account...</option>
                      {(payForm.method === "CASH" ? cashAccounts : bankAccounts).map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </label>
                  {payForm.method === "CHECK" && (
                    <label style={labelStyle}>Check No. *
                      <input type="text" value={payForm.referenceNo} onChange={e=>setPayForm({...payForm, referenceNo: e.target.value})} style={inputStyle} placeholder="Chq #..." />
                    </label>
                  )}
                </div>

                <label style={labelStyle}>Notes / Description<textarea value={payForm.notes} onChange={e=>setPayForm({...payForm, notes: e.target.value})} style={{...inputStyle, height: "80px", resize: "vertical"}}></textarea></label>
              </div>
              <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e9f0", display: "flex", justifyContent: "flex-end", gap: 10, background: "#fbfcfe" }}>
                <button type="button" onClick={() => setShowPaymentForm(false)} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #e5e9f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={busy} style={{ padding: "10px 18px", borderRadius: 9, border: 0, background: busy ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>{busy ? "Saving..." : "Save Draft"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}