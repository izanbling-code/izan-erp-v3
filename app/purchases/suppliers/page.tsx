"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  taxNumber: string | null;
  openingBalance: string | number;
  creditLimit: string | number;
  status: string;
  createdAt: string;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("ACTIVE");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  async function loadSuppliers(value = search) {
    try {
      setLoading(true);
      setError("");

      const query = value.trim()
        ? `?search=${encodeURIComponent(value.trim())}`
        : "";

      const response = await fetch(`/api/suppliers${query}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load suppliers"
        );
      }

      setSuppliers(data.suppliers || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load suppliers"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers("");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

    function resetForm() {
    setName(""); setEmail(""); setPhone(""); setAddress("");
    setCity(""); setTaxNumber(""); setOpeningBalance(""); setAsOfDate(new Date().toISOString().slice(0, 10));
    setStatus("ACTIVE"); setEditingId(null);
  }

  function openEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setName(supplier.name); setEmail(supplier.email || ""); setPhone(supplier.phone || "");
    setAddress(supplier.address || ""); setCity(supplier.city || ""); setTaxNumber(supplier.taxNumber || "");
    setOpeningBalance(String(supplier.openingBalance || "0")); setStatus(supplier.status || "ACTIVE");
    setError(""); setSuccess(""); setShowForm(true);
  }

  async function deleteSupplier(id: string) {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const res = await fetch("/api/suppliers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.ok) { setSuccess(data.message); loadSuppliers(); } else setError(data.error);
    } catch (e) { setError("Error deleting supplier"); }
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);

            const payload: any = {
        name: name.trim(), email: email.trim(), phone: phone.trim(),
        address: address.trim(), city: city.trim(), taxNumber: taxNumber.trim(),
      };
      
      if (editingId) {
        payload.id = editingId;
        payload.status = status;
      } else {
        payload.openingBalance = Number(openingBalance) || 0;
        payload.asOfDate = asOfDate;
      }

      const response = await fetch("/api/suppliers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create supplier"
        );
      }

      setSuppliers((current) =>
        [...current, data.supplier].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setSuccess("Supplier created successfully.");
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create supplier"
      );
    } finally {
      setSaving(false);
    }
  }

  const activeCount = suppliers.filter(
    (supplier) => supplier.status === "ACTIVE"
  ).length;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 13px",
    border: "1px solid #e5e9f0",
    borderRadius: "10px",
    background: "#fff",
    color: "#172033",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
  };

  return (
    <div className="dashboard">

      <div
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <h1 className="dashboard-title">
            Suppliers
          </h1>

          <p className="dashboard-description">
            Manage suppliers, contact information,
            purchasing relationships and balances.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(true);
          }}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: 0,
            borderRadius: "10px",
            padding: "11px 18px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Add Supplier
        </button>
      </div>

      <div
        className="summary-grid"
        style={{ marginBottom: 22 }}
      >
        <div className="summary-card">
          <div className="summary-card-label">
            Total Suppliers
          </div>

          <div className="summary-card-value">
            {suppliers.length}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-label">
            Active Suppliers
          </div>

          <div className="summary-card-value">
            {activeCount}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-label">
            Search Results
          </div>

          <div className="summary-card-value">
            {suppliers.length}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: "10px",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: "10px",
            background: "#f0fdf4",
            color: "#15803d",
            border: "1px solid #bbf7d0",
            fontSize: 14,
          }}
        >
          {success}
        </div>
      )}

      <div className="dashboard-panel">

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#172033",
              }}
            >
              Supplier Directory
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              Search and manage all suppliers.
            </p>
          </div>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by name, email or phone..."
            style={{
              ...inputStyle,
              width: 300,
            }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="erp-data-table">
            <thead>
              <tr
                style={{
                  borderBottom:
                    "1px solid #e5e9f0",
                }}
              >
                <th style={{
                  textAlign: "left",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  SUPPLIER
                </th>

                <th style={{
                  textAlign: "left",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  CONTACT
                </th>

                <th style={{
                  textAlign: "left",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  LOCATION
                </th>

                <th style={{
                  textAlign: "left",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  TAX NUMBER
                </th>

                <th style={{
                  textAlign: "right",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  OPENING BALANCE
                </th>

                <th style={{
                  textAlign: "center",
                  padding: "13px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                }}>
                  STATUS</th><th >ACTIONS</th></tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 35,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    Loading suppliers...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 45,
                      textAlign: "center",
                      color: "#6b7280",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: 6,
                      }}
                    >
                      No suppliers found
                    </div>

                    <div style={{ fontSize: 13 }}>
                      Click <strong>+ Add Supplier</strong>{" "}
                      to create your first supplier.
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    style={{
                      borderBottom:
                        "1px solid #eef1f5",
                    }}
                  >
                    <td >
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#172033",
                        }}
                      >
                        {supplier.name}
                      </div>

                      {supplier.address && (
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {supplier.address}
                        </div>
                      )}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      <div>
                        {supplier.phone || "—"}
                      </div>

                      <div style={{ marginTop: 3 }}>
                        {supplier.email || "—"}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      {supplier.city || "—"}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      {supplier.taxNumber || "—"}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#172033",
                      }}
                    >
                      {Number(
                        supplier.openingBalance || 0
                      ).toLocaleString()}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        textAlign: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            supplier.status === "ACTIVE"
                              ? "#dcfce7"
                              : "#f3f4f6",
                          color:
                            supplier.status === "ACTIVE"
                              ? "#15803d"
                              : "#6b7280",
                        }}
                      >
                        {supplier.status || "ACTIVE"}
                      </span>
                    </td>
                    <td >
                      <Link href={`/purchases/suppliers/ledger/${supplier.id}`} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4f46e5", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginRight: "8px", textDecoration: "none" }}>Ledger</Link> <button onClick={() => openEdit(supplier)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "bold", marginRight: "8px" }}>Edit</button>
                      <button onClick={() => deleteSupplier(supplier.id)} style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}

            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              boxShadow:
                "0 20px 60px rgba(0,0,0,.18)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom:
                  "1px solid #e5e9f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: "#172033",
                    fontSize: 20,
                  }}
                >
                  {editingId ? "Edit Supplier" : "Add Supplier"}</h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  Enter the supplier information below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                style={{
                  border: 0,
                  background: "#f3f4f6",
                  color: "#374151",
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>

              <div
                style={{
                  padding: 24,
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: 18,
                }}
              >
                <label
                  style={{
                    ...labelStyle,
                    gridColumn: "1 / -1",
                  }}
                >
                  Supplier Name *
                  <input
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder="Enter supplier name"
                    style={inputStyle}
                    autoFocus
                  />
                </label>

                <label style={labelStyle}>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="supplier@example.com"
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Phone
                  <input
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder="03xx-xxxxxxx"
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  City
                  <input
                    value={city}
                    onChange={(event) =>
                      setCity(event.target.value)
                    }
                    placeholder="City"
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Tax Number / NTN
                  <input
                    value={taxNumber}
                    onChange={(event) =>
                      setTaxNumber(event.target.value)
                    }
                    placeholder="Tax number"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Opening Balance (₨)
                  <input
                    type={editingId ? "text" : "number"} min="0"
                    step="0.01"
                    disabled={!!editingId} value={editingId ? "Locked" : openingBalance}
                    onChange={(event) => setOpeningBalance(event.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  As of Date
                  <input
                    type="date"
                    disabled={!!editingId} value={asOfDate}
                    onChange={(event) => setAsOfDate(event.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label
                  style={{
                    ...labelStyle,
                    gridColumn: "1 / -1",
                  }}
                >
                  Address
                  <textarea
                    value={address}
                    onChange={(event) =>
                      setAddress(event.target.value)
                    }
                    placeholder="Supplier address"
                    rows={3}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  padding: "16px 24px",
                  borderTop:
                    "1px solid #e5e9f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 9,
                    border:
                      "1px solid #e5e9f0",
                    background: "#fff",
                    color: "#374151",
                    fontWeight: 600,
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 9,
                    border: 0,
                    background: saving
                      ? "#93c5fd"
                      : "#2563eb",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Save Supplier"}
                </button>
              </div>

                          {editingId && (
                <div style={{ padding: "0 24px", marginTop: "15px" }}>
                  <label style={labelStyle}>
                    Supplier Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}