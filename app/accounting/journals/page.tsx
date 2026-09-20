"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type JournalLine = {
  id?: string;
  accountId: string;
  description: string | null;
  debit: string;
  credit: string;
  account?: Account;
};

type JournalEntry = {
  id: string;
  entryNumber: string;
  entryDate: string;
  reference: string | null;
  description: string | null;
  status: "DRAFT" | "POSTED" | "VOID";
  referenceType?: string | null;
  lines: JournalLine[];
};

type FormLine = {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
};

const blankLine = (): FormLine => ({
  accountId: "",
  description: "",
  debit: "",
  credit: "",
});

export default function JournalEntriesPage() {
  const cleanEntryNumber = (no: string | null | undefined) => no ? no.replace(/-\d{4}-/, '-').replace(/-0+(?=\d)/g, '-') : '—';
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] =
    useState<JournalEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<FormLine[]>([
    blankLine(),
    blankLine(),
  ]);

  async function loadEntries() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }

      const response = await fetch(
        `/api/accounting/journals?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to load journal entries."
        );
      }

      setEntries(data.entries || []);
      setAccounts(data.accounts || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load journal entries."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, [statusFilter]);

  const totals = useMemo(() => {
    const debit = lines.reduce(
      (sum, line) => sum + (Number(line.debit) || 0),
      0
    );

    const credit = lines.reduce(
      (sum, line) => sum + (Number(line.credit) || 0),
      0
    );

    return {
      debit,
      credit,
      difference: debit - credit,
      balanced:
        debit > 0 &&
        credit > 0 &&
        Math.abs(debit - credit) <= 0.005,
    };
  }, [lines]);

  const stats = useMemo(() => {
    return {
      total: entries.length,
      drafts: entries.filter((e) => e.status === "DRAFT").length,
      posted: entries.filter((e) => e.status === "POSTED").length,
      voided: entries.filter((e) => e.status === "VOID").length,
    };
  }, [entries]);

  function openCreate() {
    setEditingId(null);
    setSelectedEntry(null);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setDescription("");
    setLines([blankLine(), blankLine()]);
    setError("");
    setShowForm(true);
  }

  function openEdit(entry: JournalEntry) {
    if (entry.status !== "DRAFT") return;

    setSelectedEntry(null);
    setEditingId(entry.id);
    setEntryDate(new Date(entry.entryDate).toISOString().slice(0, 10));
    setReference(entry.reference || "");
    setDescription(entry.description || "");
    setLines(
      entry.lines.map((line) => ({
        accountId: line.accountId,
        description: line.description || "",
        debit: Number(line.debit) > 0 ? String(line.debit) : "",
        credit: Number(line.credit) > 0 ? String(line.credit) : "",
      }))
    );
    setError("");
    setShowForm(true);
  }
  function closeForm() {
    if (saving) return;
    setEditingId(null);
    setShowForm(false);
    setSelectedEntry(null);
  }

  function updateLine(
    index: number,
    field: keyof FormLine,
    value: string
  ) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        if (field === "debit" && Number(value) > 0) {
          return {
            ...line,
            debit: value,
            credit: "",
          };
        }

        if (field === "credit" && Number(value) > 0) {
          return {
            ...line,
            credit: value,
            debit: "",
          };
        }

        return {
          ...line,
          [field]: value,
        };
      })
    );
  }

  function addLine() {
    setLines((current) => [...current, blankLine()]);
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return;

    setLines((current) =>
      current.filter((_, lineIndex) => lineIndex !== index)
    );
  }

  async function saveEntry(status: "DRAFT" | "POSTED") {
    if (lines.length < 2) {
      setError("A journal entry requires at least two lines.");
      return;
    }

    if (status === "POSTED" && !totals.balanced) {
      setError(
        "The journal entry must be balanced before it can be posted."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/accounting/journals", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingId ? { id: editingId, action: "EDIT", entryDate, reference: reference || null, description: description || null, lines } : { entryDate, reference: reference || null, description: description || null, status, lines }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to save journal entry."
        );
      }

      setShowForm(false);
      setEditingId(null);
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save journal entry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function journalAction(
    entry: JournalEntry,
    action: "POST" | "VOID"
  ) {
    const message =
      action === "POST"
        ? `Post ${entry.entryNumber}? This will make the journal entry permanent.`
        : `Void ${entry.entryNumber}?`;

    if (!window.confirm(message)) return;

    try {
      setError("");

      const response = await fetch("/api/accounting/journals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: entry.id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to update journal entry."
        );
      }

      setSelectedEntry(null);
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update journal entry."
      );
    }
  }

  async function reverseEntry(entry: JournalEntry) {
    if (entry.status !== "POSTED") return;

    const confirmed = window.confirm(
      `Reverse ${entry.entryNumber}? This will create a new posted journal entry with all debits and credits reversed.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch("/api/accounting/journals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: entry.id,
          action: "REVERSE",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Failed to reverse journal entry."
        );
      }

      setSelectedEntry(null);
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reverse journal entry."
      );
    }
  }
  function formatAmount(value: string | number) {
    return Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function statusStyle(status: JournalEntry["status"]) {
    if (status === "POSTED") {
      return {
        background: "#ecfdf5",
        color: "#047857",
      };
    }

    if (status === "VOID") {
      return {
        background: "#fef2f2",
        color: "#b91c1c",
      };
    }

    return {
      background: "#fff7ed",
      color: "#c2410c",
    };
  }

  return (
    <div className="erp-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Journal Entries
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            Record and manage double-entry accounting transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          style={{
            border: 0,
            borderRadius: 8,
            padding: "10px 16px",
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + {editingId ? "Edit Draft Journal Entry" : "New Journal Entry"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Total Entries
          </div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>
            {stats.total}
          </div>
        </div>

        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Draft
          </div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>
            {stats.drafts}
          </div>
        </div>

        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Posted
          </div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>
            {stats.posted}
          </div>
        </div>

        <div className="erp-card">
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Void
          </div>
          <div style={{ fontSize: 25, fontWeight: 700, marginTop: 5 }}>
            {stats.voided}
          </div>
        </div>
      </div>

      <div className="erp-card">
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") loadEntries();
            }}
            placeholder="Search entry number, reference or description..."
            style={{
              flex: "1 1 300px",
              minWidth: 240,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              outline: "none",
            }}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 12px",
              background: "#fff",
              fontSize: 14,
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>

          <button
            type="button"
            onClick={loadEntries}
            disabled={loading}
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "10px 13px",
              background: "#fff",
              cursor: loading ? "default" : "pointer",
              fontSize: 14,
            }}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "11px 13px",
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            Loading journal entries...
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              padding: 48,
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
              No journal entries found
            </div>

            <div style={{ fontSize: 14 }}>
              Create a journal entry to begin recording accounting
              transactions.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="erp-data-table">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    textAlign: "left",
                  }}
                >
                  <th >Entry #</th>
                  <th >Date</th>
                  <th >Reference</th>
                  <th >Description</th>
                  <th >Debit</th>
                  <th >Credit</th>
                  <th >Status</th>
                  <th >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {entries.map((entry) => {
                  const debit = entry.lines.reduce(
                    (sum, line) => sum + Number(line.debit),
                    0
                  );

                  const credit = entry.lines.reduce(
                    (sum, line) => sum + Number(line.credit),
                    0
                  );

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <td
                        style={{
                          padding: "13px 10px",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}
                      >{cleanEntryNumber(entry.entryNumber)}</td>

                      <td >
                        {new Date(entry.entryDate).toLocaleDateString(
                          "en-PK"
                        )}
                      </td>

                      <td >{cleanEntryNumber(entry.reference)}</td>

                      <td >
                        {entry.description || "—"}
                      </td>

                      <td
                        style={{
                          padding: "13px 10px",
                          textAlign: "right",
                        }}
                      >
                        {formatAmount(debit)}
                      </td>

                      <td
                        style={{
                          padding: "13px 10px",
                          textAlign: "right",
                        }}
                      >
                        {formatAmount(credit)}
                      </td>

                      <td >
                        <span
                          style={{
                            display: "inline-flex",
                            borderRadius: 999,
                            padding: "4px 9px",
                            fontSize: 12,
                            fontWeight: 600,
                            ...statusStyle(entry.status),
                          }}
                        >
                          {entry.status}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "13px 10px",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#374151",
                            cursor: "pointer",
                            fontWeight: 600,
                            marginRight: 10,
                          }}
                        >
                          View
                        </button>

                        {entry.status === "DRAFT" && (
                      <>
                        <button type="button" onClick={() => openEdit(entry)} style={{ border: 0, background: "transparent", color: "#2563eb", cursor: "pointer", fontWeight: 600, marginRight: 10 }}>Edit</button>
                          <button
                            type="button"
                            onClick={() =>
                              journalAction(entry, "POST")
                            }
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "#047857",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Post
                          </button>
                        </>
                        )}

                        {entry.status === "POSTED" && (
                          <button
                            type="button"
                            onClick={() =>
                              journalAction(entry, "VOID")
                            }
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "#dc2626",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Void
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1050,
              maxHeight: "92vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 20px 50px rgba(0,0,0,.18)",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {editingId ? "Edit Draft Journal Entry" : "New Journal Entry"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  Record a balanced double-entry accounting transaction.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 22,
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 1fr",
                gap: 14,
                marginBottom: 20,
              }}
            >
              <label>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Entry Date *
                </div>

                <input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "10px 11px",
                  }}
                />
              </label>

              <label>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Reference
                </div>

                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="e.g. ADJ-001"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "10px 11px",
                  }}
                />
              </label>

              <label>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Description
                </div>

                <input
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Journal description"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "10px 11px",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2.2fr 1.5fr 1fr 1fr 42px",
                  gap: 0,
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#4b5563",
                }}
              >
                <div style={{ padding: "11px 10px" }}>Account</div>
                <div style={{ padding: "11px 10px" }}>Description</div>
                <div style={{ padding: "11px 10px", textAlign: "right" }}>
                  Debit
                </div>
                <div style={{ padding: "11px 10px", textAlign: "right" }}>
                  Credit
                </div>
                <div />
              </div>

              {lines.map((line, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2.2fr 1.5fr 1fr 1fr 42px",
                    gap: 0,
                    borderBottom:
                      index === lines.length - 1
                        ? "none"
                        : "1px solid #f0f0f0",
                  }}
                >
                  <div style={{ padding: 7 }}>
                    <select
                      value={line.accountId}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "accountId",
                          event.target.value
                        )
                      }
                      style={{
                        width: "100%",
                        border: "1px solid #d1d5db",
                        borderRadius: 7,
                        padding: "9px 8px",
                        background: "#fff",
                        fontSize: 13,
                      }}
                    >
                      <option value="">Select account...</option>

                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} — {account.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ padding: 7 }}>
                    <input
                      value={line.description}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Line description"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #d1d5db",
                        borderRadius: 7,
                        padding: "9px 8px",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div style={{ padding: 7 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.debit}
                      onChange={(event) =>
                        updateLine(index, "debit", event.target.value)
                      }
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #d1d5db",
                        borderRadius: 7,
                        padding: "9px 8px",
                        textAlign: "right",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div style={{ padding: 7 }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.credit}
                      onChange={(event) =>
                        updateLine(index, "credit", event.target.value)
                      }
                      placeholder="0.00"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1px solid #d1d5db",
                        borderRadius: 7,
                        padding: "9px 8px",
                        textAlign: "right",
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 2}
                      style={{
                        border: 0,
                        background: "transparent",
                        color:
                          lines.length <= 2 ? "#d1d5db" : "#dc2626",
                        cursor:
                          lines.length <= 2
                            ? "default"
                            : "pointer",
                        fontSize: 18,
                      }}
                      title="Remove line"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addLine}
              style={{
                marginTop: 12,
                border: "1px dashed #9ca3af",
                borderRadius: 7,
                background: "#fff",
                padding: "8px 12px",
                color: "#374151",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              + Add Line
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <div
                style={{
                  width: 340,
                  border: "1px solid #e5e7eb",
                  borderRadius: 9,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 13px",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Total Debit</span>
                  <strong>
                    {formatAmount(totals.debit)}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 13px",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Total Credit</span>
                  <strong>
                    {formatAmount(totals.credit)}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "11px 13px",
                    background: totals.balanced
                      ? "#ecfdf5"
                      : "#fef2f2",
                    color: totals.balanced
                      ? "#047857"
                      : "#b91c1c",
                  }}
                >
                  <strong>
                    {totals.balanced ? "Balanced" : "Difference"}
                  </strong>

                  <strong>
                    {formatAmount(Math.abs(totals.difference))}
                  </strong>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 22,
                paddingTop: 18,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "10px 16px",
                  background: "#fff",
                  cursor: saving ? "default" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => saveEntry("DRAFT")}
                disabled={saving}
                style={{
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  padding: "10px 16px",
                  background: "#fff",
                  cursor: saving ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                {saving ? "Saving..." : editingId ? "Update Draft" : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={() => saveEntry("POSTED")}
                disabled={saving || !totals.balanced}
                style={{
                  border: 0,
                  borderRadius: 8,
                  padding: "10px 18px",
                  background:
                    saving || !totals.balanced
                      ? "#9ca3af"
                      : "#111827",
                  color: "#fff",
                  fontWeight: 600,
                  cursor:
                    saving || !totals.balanced
                      ? "default"
                      : "pointer",
                }}
              >
                {saving ? "Posting..." : "Post Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 12,
              boxShadow: "0 20px 50px rgba(0,0,0,.18)",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 20,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 21,
                    fontWeight: 700,
                  }}
                >{cleanEntryNumber(selectedEntry.entryNumber)}</h2>

                <div
                  style={{
                    marginTop: 5,
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  {new Date(
                    selectedEntry.entryDate
                  ).toLocaleDateString("en-PK")}
                  {" • "}
                  {selectedEntry.reference || "No reference"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 22,
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {selectedEntry.description && (
              <div
                style={{
                  marginBottom: 18,
                  padding: 12,
                  background: "#f9fafb",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "#374151",
                }}
              >
                {selectedEntry.description}
              </div>
            )}

            <table className="erp-data-table">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    textAlign: "left",
                  }}
                >
                  <th >Account</th>
                  <th >Description</th>
                  <th >
                    Debit
                  </th>
                  <th >
                    Credit
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedEntry.lines.map((line) => (
                  <tr
                    key={line.id}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <td >
                      <strong>
                        {line.account?.code || "—"}
                      </strong>
                      {" — "}
                      {line.account?.name || "Unknown Account"}
                    </td>

                    <td >
                      {line.description || "—"}
                    </td>

                    <td
                      style={{
                        padding: "11px 10px",
                        textAlign: "right",
                      }}
                    >
                      {formatAmount(line.debit)}
                    </td>

                    <td
                      style={{
                        padding: "11px 10px",
                        textAlign: "right",
                      }}
                    >
                      {formatAmount(line.credit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  ...statusStyle(selectedEntry.status),
                }}
              >
                {selectedEntry.status}
              </span>

              <div style={{ display: "flex", gap: 10 }}>
                {selectedEntry.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() =>
                      journalAction(selectedEntry, "POST")
                    }
                    style={{
                      border: 0,
                      borderRadius: 8,
                      padding: "10px 16px",
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Post Entry
                  </button>
                )}

                {selectedEntry.status === "POSTED" && (
                  <button
                    type="button"
                    onClick={() =>
                      journalAction(selectedEntry, "VOID")
                    }
                    style={{
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: "10px 16px",
                      background: "#fff",
                      color: "#dc2626",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Void Entry
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "10px 16px",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

