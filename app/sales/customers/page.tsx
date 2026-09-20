"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";

type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null; city: string | null; taxNumber: string | null; openingBalance: string | number; status: string; createdAt: string; };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("ACTIVE");

  async function loadCustomers(value = search) {
    try {
      setLoading(true);
      const query = value.trim() ? `?search=${encodeURIComponent(value.trim())}` : "";
      const response = await fetch(`/api/customers${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load customers");
      setCustomers(data.customers || []);
    } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  }

  useEffect(() => { loadCustomers(""); }, []);
  useEffect(() => { const timer = setTimeout(() => { loadCustomers(search); }, 300); return () => clearTimeout(timer); }, [search]);

  function resetForm() {
    setName(""); setEmail(""); setPhone(""); setAddress(""); setCity(""); setTaxNumber("");
    setOpeningBalance(""); setAsOfDate(new Date().toISOString().slice(0, 10)); setStatus("ACTIVE"); setEditingId(null);
  }

  function openEdit(customer: Customer) {
    setEditingId(customer.id); setName(customer.name); setEmail(customer.email || ""); setPhone(customer.phone || "");
    setAddress(customer.address || ""); setCity(customer.city || ""); setTaxNumber(customer.taxNumber || "");
    setOpeningBalance(String(customer.openingBalance || "0")); setStatus(customer.status || "ACTIVE");
    setShowForm(true);
  }

  async function deleteCustomer(id: string) {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await fetch("/api/customers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.ok) { toast.success(data.message); loadCustomers(); } else toast.error(data.error);
    } catch (e) { toast.error("Error deleting customer"); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Customer name is required.");
    try {
      setSaving(true);
      const payload: any = { name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), taxNumber: taxNumber.trim() };
      if (editingId) { payload.id = editingId; payload.status = status; } else { payload.openingBalance = Number(openingBalance) || 0; payload.asOfDate = asOfDate; }
      
      const response = await fetch("/api/customers", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save customer");
      
      toast.success(editingId ? "Customer updated" : "Customer created");
      setShowForm(false); resetForm(); loadCustomers();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;
  const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 13px", border: "1px solid #e5e9f0", borderRadius: "10px", background: "#fff", color: "#172033", fontSize: "14px", outline: "none", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "7px", fontSize: "13px", fontWeight: 600, color: "#374151" };

  return (
    <div className="dashboard">
      <Toaster position="top-right" />
      <div className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
        <div><h1 className="dashboard-title">Customers</h1><p className="dashboard-description">Manage customers, contact information, and receivables.</p></div>
        <button type="button" data-shortcut="a" onClick={() => { resetForm(); setShowForm(true); }} style={{ background: "#2563eb", color: "#fff", border: 0, borderRadius: "10px", padding: "11px 18px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Add Customer</button>
      </div>

      <div className="summary-grid" style={{ marginBottom: 22 }}>
        <div className="summary-card"><div className="summary-card-label">Total Customers</div><div className="summary-card-value">{customers.length}</div></div>
        <div className="summary-card"><div className="summary-card-label">Active Customers</div><div className="summary-card-value">{activeCount}</div></div>
        <div className="summary-card"><div className="summary-card-label">Search Results</div><div className="summary-card-value">{customers.length}</div></div>
      </div>

      <div className="dashboard-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#172033" }}>Customer Directory</h2><p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>Search and manage all customers.</p></div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or phone..." style={{ ...inputStyle, width: 300 }} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="erp-data-table">
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e9f0" }}>
                <th >CUSTOMER</th>
                <th >CONTACT</th>
                <th >LOCATION</th>
                <th >OPENING BALANCE</th>
                <th >STATUS</th>
                <th >ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? ( <tr><td colSpan={6} >Loading customers...</td></tr> ) : customers.length === 0 ? ( <tr><td colSpan={6} >No customers found</td></tr> ) : (
                customers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eef1f5" }}>
                    <td ><div style={{ fontWeight: 700, color: "#172033" }}>{c.name}</div>{c.address && <div style={{ marginTop: 3, fontSize: 12, color: "#6b7280" }}>{c.address}</div>}</td>
                    <td ><div>{c.phone || "—"}</div><div style={{ marginTop: 3 }}>{c.email || "—"}</div></td>
                    <td >{c.city || "—"}</td>
                    <td >{Number(c.openingBalance || 0).toLocaleString()}</td>
                    <td ><span style={{ display: "inline-block", padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.status === "ACTIVE" ? "#dcfce7" : "#f3f4f6", color: c.status === "ACTIVE" ? "#15803d" : "#6b7280" }}>{c.status || "ACTIVE"}</span></td>
                    <td >
                      <Link href={`/sales/customers/ledger/${c.id}`} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4f46e5", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginRight: "8px", textDecoration: "none" }}>Ledger</Link>
                      <button onClick={() => openEdit(c)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginRight: "8px" }}>Edit</button>
                      <button onClick={() => deleteCustomer(c.id)} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }} onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h2 style={{ margin: 0, color: "#172033", fontSize: 20 }}>{editingId ? "Edit Customer" : "Add Customer"}</h2><p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>Enter the customer information below.</p></div>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ border: 0, background: "#f3f4f6", color: "#374151", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Customer Name *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter customer name" style={inputStyle} autoFocus /></label>
                <label style={labelStyle}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" style={inputStyle} /></label>
                <label style={labelStyle}>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" style={inputStyle} /></label>
                <label style={labelStyle}>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={inputStyle} /></label>
                <label style={labelStyle}>Tax Number / NTN<input value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="Tax number" style={inputStyle} /></label>
                <label style={labelStyle}>Opening Balance (₨)<input type={editingId ? "text" : "number"} min="0" step="0.01" value={editingId ? "Locked" : openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} disabled={!!editingId} placeholder="0.00" style={inputStyle} /></label>
                <label style={labelStyle}>As of Date<input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} disabled={!!editingId} style={inputStyle} /></label>
                <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>Address<textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Customer address" rows={3} style={{ ...inputStyle, resize: "vertical" }} /></label>
              </div>
              {editingId && (
                <div style={{ padding: "0 24px", marginTop: "15px", marginBottom: "15px" }}>
                  <label style={labelStyle}>Customer Status<select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
                </div>
              )}
              <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e9f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} disabled={saving} style={{ padding: "10px 16px", borderRadius: 9, border: "1px solid #e5e9f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: "10px 18px", borderRadius: 9, border: 0, background: saving ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : "Save Customer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}