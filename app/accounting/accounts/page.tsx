"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

type Account = {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  type: AccountType;
  description: string | null;
  isActive: boolean;
  systemCode: string | null;
  createdAt: string;
  updatedAt: string;
};

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expense",
};

const emptyForm = {
  id: "",
  code: "",
  name: "",
  type: "ASSET" as AccountType,
  parentId: "",
  description: "",
  isActive: true,
};

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AccountType>("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to load accounts.");
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  // 👑 UPGRADED HIERARCHY LOGIC 👑
  const hierarchicalAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    
    // Step 1: Run standard filters
    const filtered = accounts.filter((account) => {
      if (!showInactive && !account.isActive) return false;
      if (typeFilter !== "ALL" && account.type !== typeFilter) return false;
      if (!query) return true;
      return (
        account.code.toLowerCase().includes(query) ||
        account.name.toLowerCase().includes(query) ||
        TYPE_LABELS[account.type].toLowerCase().includes(query)
      );
    });

    // Step 2: Separate Parents and Children
    const parents = filtered.filter(a => !a.parentId).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    const children = filtered.filter(a => a.parentId);
    
    // Step 3: Rebuild the array in perfect hierarchical order
    const sortedList: (Account & { isSubAccount: boolean })[] = [];
    
    parents.forEach(parent => {
      sortedList.push({ ...parent, isSubAccount: false });
      
      const myChildren = children
        .filter(c => c.parentId === parent.id)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        
      myChildren.forEach(child => {
        sortedList.push({ ...child, isSubAccount: true });
      });
    });

    // Step 4: Catch any orphaned accounts (if you searched for a child but not the parent)
    const addedIds = new Set(sortedList.map(a => a.id));
    filtered.forEach(a => {
      if (!addedIds.has(a.id)) {
        sortedList.push({ ...a, isSubAccount: false });
      }
    });

    return sortedList;
  }, [accounts, search, typeFilter, showInactive]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || "",
      description: account.description || "",
      isActive: account.isActive,
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = {
        id: editing?.id || undefined,
        code: form.code,
        name: form.name,
        type: form.type,
        parentId: form.parentId || null,
        description: form.description || null,
        isActive: form.isActive,
      };
      const response = await fetch("/api/accounts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to save account.");
      await loadAccounts();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(account: Account) {
    if (account.systemCode) {
      setError("System accounts cannot be deleted.");
      return;
    }
    const confirmed = window.confirm(`Delete "${account.code} - ${account.name}"?\n\nAccounts with historical references will automatically be deactivated instead.`);
    if (!confirmed) return;
    try {
      setError("");
      const response = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Failed to delete account.");
      await loadAccounts();
      if (data.deactivated) setError(data.message || "Account was deactivated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    }
  }

  // 🚀 UPGRADED IMPORT LOGIC WITH FAILSAFES
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/accounting/accounts/import", {
        method: "POST",
        body: formData,
      });

      // Safely parse JSON to prevent silent crashes
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error("Server crashed or returned invalid data. Ensure your Excel columns perfectly match the template!");
      }
      
      if (!response.ok || !data.ok) throw new Error(data.error || "Import failed. Please check your file formatting.");

      alert(data.message || "Accounts imported successfully!");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import accounts.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // 📝 DOWNLOAD TEMPLATE LOGIC
  function downloadTemplate() {
    const headers = ["Code", "Name", "Type", "Description", "ParentCode"];
    const row1 = ["1000", "Bank Accounts", "ASSET", "Main parent asset account", ""];
    const row2 = ["1001", "Chase Checking", "ASSET", "Sub account example", "1000"];
    
    const csvContent = [
      headers.join(","),
      row1.join(","),
      row2.join(",")
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ChartOfAccounts_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getParentName(parentId: string | null) {
    if (!parentId) return "—";
    const parent = accountMap.get(parentId);
    return parent ? `${parent.code} — ${parent.name}` : "—";
  }

  const activeCount = accounts.filter((account) => account.isActive).length;
  const systemCount = accounts.filter((account) => account.systemCode).length;

  return (
    <div className="erp-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>Chart of Accounts</h1>
          <p style={{ margin: "7px 0 0", color: "#6b7280", fontSize: 14 }}>Manage your company's accounting structure and account hierarchy.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {/* Hidden File Input */}
          <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />

          {/* New Template Button */}
          <button type="button" onClick={downloadTemplate} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 16px", background: "#f3f4f6", color: "#374151", fontWeight: 600, cursor: "pointer" }}>
            📄 Template
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 16px", background: "#fff", color: "#374151", fontWeight: 600, cursor: importing ? "default" : "pointer" }}>
            {importing ? "⏳ Importing..." : "📥 Import Excel"}
          </button>

          <button type="button" onClick={openCreate} style={{ border: 0, borderRadius: 8, padding: "10px 16px", background: "#111827", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            + New Account
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>Total Accounts</div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>{accounts.length}</div>
        </div>
        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>Active Accounts</div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>{activeCount}</div>
        </div>
        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>System Accounts</div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>{systemCount}</div>
        </div>
      </div>

      <div className="erp-card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, name or type..." style={{ flex: "1 1 280px", minWidth: 220, border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, outline: "none" }} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "ALL" | AccountType)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", background: "#fff", fontSize: 14 }}>
            <option value="ALL">All Types</option>
            {ACCOUNT_TYPES.map((type) => (
              <option key={type} value={type}>{TYPE_LABELS[type]}</option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: "#4b5563", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Show inactive
          </label>
          <button type="button" onClick={loadAccounts} disabled={loading} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 13px", background: "#fff", cursor: loading ? "default" : "pointer", fontSize: 14 }}>
            Refresh
          </button>
        </div>

        {error && <div style={{ marginBottom: 16, padding: "11px 13px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 14, fontWeight: 600 }}>{error}</div>}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading accounts...</div>
        ) : hierarchicalAccounts.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No accounts found</div>
            <div style={{ fontSize: 14 }}>Create your first account or adjust your filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="erp-data-table">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  <th >Code</th>
                  <th >Account Name</th>
                  <th >Type</th>
                  <th >Parent Account</th>
                  <th >Status</th>
                  <th >Actions</th>
                </tr>
              </thead>
              <tbody>
                {hierarchicalAccounts.map((account) => (
                  <tr key={account.id} style={{ borderBottom: "1px solid #f0f0f0", opacity: account.isActive ? 1 : 0.58, background: account.isSubAccount ? "#fafafa" : "#ffffff" }}>
                    <td >
                      {account.isSubAccount && <span style={{ color: "#9ca3af", marginRight: 8 }}>↳</span>}
                      {account.code}
                    </td>
                    <td >
                      <div style={{ fontWeight: account.isSubAccount ? 500 : 700, color: account.isSubAccount ? "#4b5563" : "#111827" }}>{account.name}</div>
                      {account.description && <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 3 }}>{account.description}</div>}
                      {account.systemCode && <div style={{ color: "#6b7280", fontSize: 11, marginTop: 3 }}>System: {account.systemCode}</div>}
                    </td>
                    <td >{TYPE_LABELS[account.type]}</td>
                    <td >{getParentName(account.parentId)}</td>
                    <td >
                      <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 600, background: account.isActive ? "#ecfdf5" : "#f3f4f6", color: account.isActive ? "#047857" : "#6b7280" }}>
                        {account.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td >
                      <button type="button" onClick={() => openEdit(account)} style={{ border: 0, background: "transparent", color: "#374151", cursor: "pointer", fontWeight: 600, marginRight: 12 }}>Edit</button>
                      {!account.systemCode && (
                        <button type="button" onClick={() => handleDelete(account)} style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ width: "100%", maxWidth: 620, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,.18)", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editing ? "Edit Account" : "New Account"}</h2>
                <p style={{ margin: "5px 0 0", color: "#6b7280", fontSize: 13 }}>{editing?.systemCode ? "System account details are protected." : "Enter the account details below."}</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} style={{ border: 0, background: "transparent", fontSize: 22, color: "#6b7280", cursor: "pointer" }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <label>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Account Code *</div>
                  <input value={form.code} disabled={Boolean(editing?.systemCode)} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} required style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px" }} />
                </label>
                <label>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Account Type *</div>
                  <select value={form.type} disabled={Boolean(editing?.systemCode)} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AccountType }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px", background: "#fff" }}>
                    {ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Account Name *</div>
                  <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px" }} />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Parent Account</div>
                  <select value={form.parentId} onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px", background: "#fff" }}>
                    <option value="">No parent — top-level account</option>
                    {accounts.filter((account) => editing ? account.id !== editing.id && account.isActive : account.isActive).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).map((account) => (
                      <option key={account.id} value={account.id}>{account.code} — {account.name}</option>
                    ))}
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Description</div>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} style={{ width: "100%", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 11px", resize: "vertical" }} />
                </label>
                {editing && (
                  <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Account is active
                  </label>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 18, borderTop: "1px solid #e5e7eb" }}>
                <button type="button" onClick={closeForm} disabled={saving} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 16px", background: "#fff", cursor: saving ? "default" : "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 8, padding: "10px 18px", background: "#111827", color: "#fff", fontWeight: 600, cursor: saving ? "default" : "pointer" }}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Account"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
