"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "expense" | "supplier" | "receive";

type Account = {
  id: string;
  code: string;
  name: string;
};

type Party = {
  id: string;
  name: string;
};

type Bill = {
  id: string;
  billNo: string;
  supplierId: string;
  supplierName: string;
  total: number;
  paid: number;
  balance: number;
  billDate: string;
};

type Invoice = {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  total: number;
  paid: number;
  balance: number;
  invoiceDate: string;
};

type Payment = {
  id: string;
  mode: Mode;
  paymentNo: string;
  paymentDate: string;
  method: string;
  amount: number;
  reference: string | null;
  description: string | null;
  supplierId: string | null;
  supplierName: string | null;
  customerId: string | null;
  customerName: string | null;
  accountId: string;
  accountName: string | null;
  expenseAccountId: string | null;
  expenseAccountName: string | null;
  status: "UNPOSTED" | "POSTED";
  allocation: any;
};

type FormState = {
  id: string;
  paymentDate: string;
  accountId: string;
  expenseAccountId: string;
  supplierId: string;
  billId: string;
  customerId: string;
  invoiceId: string;
  method: string;
  amount: string;
  reference: string;
  description: string;
};

const labels: Record<Mode, { title: string; description: string; action: string; color: string }> = {
  supplier: {
    title: "Pay Supplier",
    description: "Pay suppliers against their outstanding bills.",
    action: "Record Supplier Payment",
    color: "#2563eb",
  },
  receive: {
    title: "Receive Payment",
    description: "Receive customer payments against invoices.",
    action: "Record Customer Receipt",
    color: "#16a34a",
  },
  expense: {
    title: "Record Expense",
    description: "Record business expenses against specific Expense Heads.",
    action: "Record Expense",
    color: "#d97706",
  },
};

const emptyForm = (): FormState => ({
  id: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  accountId: "",
  expenseAccountId: "",
  supplierId: "",
  billId: "",
  customerId: "",
  invoiceId: "",
  method: "CASH",
  amount: "",
  reference: "",
  description: "",
});

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dateText(value: string) {
  return new Date(value).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PaymentWorkspace({ mode }: { mode: Mode }) {
  const router = useRouter();
  const meta = labels[mode];

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [statusTab, setStatusTab] = useState<"UNPOSTED" | "POSTED">("POSTED");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New Expense Head Modal State
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headName, setHeadName] = useState("");
  const [headCode, setHeadCode] = useState("");
  const [headSaving, setHeadSaving] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/payments?mode=${mode}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load payments.");
      }

      setPayments(data.payments || []);
      setPaymentAccounts(data.paymentAccounts || []);
      setExpenseAccounts(data.expenseAccounts || []);
      setSuppliers(data.suppliers || []);
      setCustomers(data.customers || []);
      setBills(data.bills || []);
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [mode]);

  const filteredBills = useMemo(
    () => (form.supplierId ? bills.filter((b) => b.supplierId === form.supplierId) : bills),
    [bills, form.supplierId]
  );

  const filteredInvoices = useMemo(
    () => (form.customerId ? invoices.filter((inv) => inv.customerId === form.customerId) : invoices),
    [invoices, form.customerId]
  );

  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) => {
        if (payment.status !== statusTab) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;

        return [
          payment.paymentNo,
          payment.reference,
          payment.supplierName,
          payment.customerName,
          payment.accountName,
          payment.expenseAccountName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      }),
    [payments, search, statusTab]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError("");
  }

  function openCreate() {
    setForm(emptyForm());
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function handleCreateExpenseHead(e: React.FormEvent) {
    e.preventDefault();
    if (!headName.trim()) {
      setError("Please enter an Expense Head name.");
      return;
    }

    try {
      setHeadSaving(true);
      setError("");

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_EXPENSE_HEAD",
          name: headName.trim(),
          code: headCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to create Expense Head");

      setExpenseAccounts((prev) => [...prev, data.account]);
      update("expenseAccountId", data.account.id);
      setShowHeadModal(false);
      setHeadName("");
      setHeadCode("");
      setSuccess(`Expense Head "${data.account.name}" created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Expense Head");
    } finally {
      setHeadSaving(false);
    }
  }

  async function save(action: "SAVE" | "POST") {
    setError("");
    setSuccess("");

    const amount = Number(form.amount);

    if (!form.accountId) {
      setError("Select the Payment / Deposit account.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (mode === "expense" && !form.expenseAccountId) {
      setError("Select an Expense Head.");
      return;
    }

    if (mode === "supplier" && (!form.supplierId || !form.billId)) {
      setError("Select a supplier and purchase bill.");
      return;
    }

    if (mode === "receive" && (!form.customerId || !form.invoiceId)) {
      setError("Select a customer and sales invoice.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mode,
          amount,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to save payment.");
      }

      setShowForm(false);
      setForm(emptyForm());
      setSuccess(data.message || "Payment recorded.");
      setStatusTab(action === "POST" ? "POSTED" : "UNPOSTED");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayment(payment: Payment) {
    if (!window.confirm(`Delete ${payment.paymentNo}?\n\nThis will permanently remove the unposted transaction.`)) return;

    try {
      const response = await fetch(`/api/payments?id=${payment.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete payment.");

      setSuccess(data.message || "Payment deleted.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete payment.");
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-heading" style={{ alignItems: "center" }}>
        <div>
          <p className="eyebrow">PAYMENTS & TRANSACTIONS</p>
          <h1>{meta.title}</h1>
          <p className="dashboard-description">{meta.description}</p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          style={{
            border: 0,
            borderRadius: 9,
            background: meta.color,
            color: "#fff",
            padding: "11px 16px",
            fontSize: 13,
            fontWeight: 750,
            cursor: "pointer",
            boxShadow: "0 2px 5px rgba(15,23,42,.12)",
          }}
        >
          + {meta.action}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        {(Object.keys(labels) as Mode[]).map((item) => {
          const active = item === mode;
          return (
            <button
              key={item}
              type="button"
              onClick={() => router.push(`/payments/${item}`)}
              style={{
                textAlign: "left",
                border: active ? `2px solid ${labels[item].color}` : "1px solid #e5e9f0",
                background: active ? "#f8fbff" : "#fff",
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: `${labels[item].color}15`,
                    color: labels[item].color,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                  }}
                >
                  {item === "supplier" ? "P" : item === "receive" ? "R" : "E"}
                </div>
                <div>
                  <div style={{ color: "#172033", fontWeight: 750, fontSize: 14 }}>{labels[item].title}</div>
                  <div style={{ color: "#667085", fontSize: 11, marginTop: 3 }}>{labels[item].description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && <div style={{ marginBottom: 14, padding: "11px 14px", border: "1px solid #fecaca", background: "#fff7f7", color: "#b42318", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>{error}</div>}
      {success && <div style={{ marginBottom: 14, padding: "11px 14px", border: "1px solid #b7e4c7", background: "#f3fbf6", color: "#1e7b45", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>{success}</div>}

      <section className="dashboard-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {(["POSTED", "UNPOSTED"] as const).map((tab) => {
              const count = payments.filter((p) => p.status === tab).length;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusTab(tab)}
                  style={{
                    border: 0,
                    borderRadius: 7,
                    padding: "8px 11px",
                    background: statusTab === tab ? "#eff6ff" : "transparent",
                    color: statusTab === tab ? "#2563eb" : "#667085",
                    fontSize: 12,
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  {tab === "POSTED" ? "Posted" : "Unposted"}
                  <span style={{ marginLeft: 5, background: "#fff", border: "1px solid #e5e9f0", borderRadius: 999, padding: "2px 6px", fontSize: 10 }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment no, party, ref..."
              style={{ width: 260, height: 36, border: "1px solid #e5e9f0", borderRadius: 8, padding: "0 11px", fontSize: 12, outline: "none" }}
            />
            <button type="button" onClick={loadData} style={{ width: 36, height: 36, border: "1px solid #e5e9f0", borderRadius: 8, background: "#fff", cursor: "pointer" }}>↻</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#667085", fontSize: 13 }}>Loading transactions...</div>
        ) : visiblePayments.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#98a2b3", fontSize: 13 }}>No {statusTab.toLowerCase()} {meta.title.toLowerCase()} transactions found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="erp-data-table">
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["#", "Payment No.", mode === "supplier" ? "Supplier" : mode === "receive" ? "Customer" : "Expense Head", mode === "supplier" ? "Bill" : mode === "receive" ? "Invoice" : "Paid From", "Date", "Method", "Amount", "Reference", "Status"].map((header) => (
                    <th key={header} >{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment, index) => (
                  <tr key={payment.id}>
                    <td >{index + 1}</td>
                    <td >{payment.paymentNo}</td>
                    <td >
                      {mode === "supplier" ? payment.supplierName : mode === "receive" ? payment.customerName : payment.accountName}
                    </td>
                    <td >
                      {mode === "supplier" ? payment.allocation?.billNo || "—" : mode === "receive" ? payment.allocation?.invoiceNo || "—" : payment.accountName}
                    </td>
                    <td >{dateText(payment.paymentDate)}</td>
                    <td >{payment.method}</td>
                    <td >PKR {money(payment.amount)}</td>
                    <td >{payment.reference || "—"}</td>
                    <td >
                      <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: payment.status === "POSTED" ? "#f0fdf4" : "#fef3c7", color: payment.status === "POSTED" ? "#15803d" : "#b45309" }}>{payment.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Main Payment / Expense Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.38)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div role="dialog" style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 14, boxShadow: "0 24px 80px rgba(15,23,42,.25)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e9f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>TRANSACTION WINDOW</p>
                <h2 style={{ margin: 0, fontSize: 19, color: "#172033" }}>{meta.action}</h2>
                <p style={{ margin: "5px 0 0", color: "#667085", fontSize: 12 }}>Record financial transaction into the General Ledger.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} style={{ border: 0, background: "transparent", color: "#667085", fontSize: 24, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 15 }}>
                {mode === "supplier" && (
                  <>
                    <label style={fieldLabel}>
                      Supplier *
                      <select value={form.supplierId} onChange={(e) => { update("supplierId", e.target.value); update("billId", ""); }} style={fieldInput}>
                        <option value="">Select supplier</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                    <label style={fieldLabel}>
                      Purchase Bill *
                      <select value={form.billId} onChange={(e) => update("billId", e.target.value)} style={fieldInput}>
                        <option value="">Select outstanding bill</option>
                        {filteredBills.map((b) => <option key={b.id} value={b.id}>{b.billNo} — PKR {money(b.balance)} due</option>)}
                      </select>
                    </label>
                  </>
                )}

                {mode === "receive" && (
                  <>
                    <label style={fieldLabel}>
                      Customer *
                      <select value={form.customerId} onChange={(e) => { update("customerId", e.target.value); update("invoiceId", ""); }} style={fieldInput}>
                        <option value="">Select customer</option>
                        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label style={fieldLabel}>
                      Sales Invoice *
                      <select value={form.invoiceId} onChange={(e) => update("invoiceId", e.target.value)} style={fieldInput}>
                        <option value="">Select outstanding invoice</option>
                        {filteredInvoices.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoiceNo} — PKR {money(inv.balance)} due</option>)}
                      </select>
                    </label>
                  </>
                )}

                {mode === "expense" && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#344054" }}>Expense Head / Category (Debit) *</label>
                      <button type="button" onClick={() => setShowHeadModal(true)} style={{ border: 0, background: "transparent", color: "#d97706", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>+ New Expense Head</button>
                    </div>
                    <select value={form.expenseAccountId} onChange={(e) => update("expenseAccountId", e.target.value)} style={fieldInput}>
                      <option value="">Select Expense Head</option>
                      {expenseAccounts.map((item) => (
                        <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <label style={fieldLabel}>
                  {mode === "receive" ? "Deposit Into Account (Bank / Cash) *" : "Paid From Account (Bank / Cash) *"}
                  <select value={form.accountId} onChange={(e) => update("accountId", e.target.value)} style={fieldInput}>
                    <option value="">Select Cash / Bank Account</option>
                    {paymentAccounts.map((item) => (
                      <option key={item.id} value={item.id}>{item.code} — {item.name}</option>
                    ))}
                  </select>
                </label>

                <label style={fieldLabel}>
                  Payment Method
                  <select value={form.method} onChange={(e) => update("method", e.target.value)} style={fieldInput}>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="ONLINE">Online / Wallet</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label style={fieldLabel}>
                  Payment Date *
                  <input type="date" value={form.paymentDate} onChange={(e) => update("paymentDate", e.target.value)} style={fieldInput} />
                </label>

                <label style={fieldLabel}>
                  Amount (PKR) *
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="0.00" style={fieldInput} />
                </label>

                <label style={fieldLabel}>
                  Reference / Receipt #
                  <input value={form.reference} onChange={(e) => update("reference", e.target.value)} placeholder="Optional reference #" style={fieldInput} />
                </label>

                <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
                  Description / Notes
                  <textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Optional transaction details" style={{ ...fieldInput, height: 70, paddingTop: 8, resize: "vertical" }} />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 22, paddingTop: 16, borderTop: "1px solid #e5e9f0" }}>
                <button type="button" disabled={saving} onClick={() => setShowForm(false)} style={secondaryButton}>Cancel</button>
                <button type="button" disabled={saving} onClick={() => save("SAVE")} style={secondaryButton}>{saving ? "Saving..." : "Save Unposted"}</button>
                <button type="button" disabled={saving} onClick={() => save("POST")} style={{ ...primaryButton, background: meta.color }}>{saving ? "Posting..." : "Save & Post"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Expense Head Modal */}
      {showHeadModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "#172033" }}>New Expense Head</h3>
            <p style={{ margin: "4px 0 16px", fontSize: 12, color: "#667085" }}>Create a new expense category in your Chart of Accounts.</p>
            
            <form onSubmit={handleCreateExpenseHead} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={fieldLabel}>
                Expense Head Name *
                <input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="e.g. Courier & Delivery, Packaging" style={fieldInput} required />
              </label>

              <label style={fieldLabel}>
                Account Code (Optional)
                <input value={headCode} onChange={(e) => setHeadCode(e.target.value)} placeholder="Leave blank to auto-generate (5xxx)" style={fieldInput} />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => setShowHeadModal(false)} style={secondaryButton}>Cancel</button>
                <button type="submit" disabled={headSaving} style={{ ...primaryButton, background: "#d97706" }}>{headSaving ? "Creating..." : "Create Head"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  fontSize: 12,
  fontWeight: 700,
  color: "#344054",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid #e5e9f0",
  borderRadius: 9,
  padding: "0 11px",
  background: "#fff",
  color: "#172033",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const secondaryButton: React.CSSProperties = {
  border: "1px solid #d8dee8",
  background: "#fff",
  color: "#344054",
  padding: "10px 15px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const primaryButton: React.CSSProperties = {
  border: 0,
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 750,
};
