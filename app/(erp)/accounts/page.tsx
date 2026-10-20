"use client";

import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  code?: string | null;
  accountCode?: string | null;
  name?: string | null;
  accountName?: string | null;
  type?: string | null;
  accountType?: string | null;
  isActive?: boolean;
  description?: string | null;
};

type LedgerRow = {
  id?: string;
  date?: string;
  entryDate?: string;
  journalNumber?: string;
  entryNumber?: string;
  reference?: string | null;
  description?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  balance?: number | string | null;
  runningBalance?: number | string | null;
  accountName?: string;
  accountCode?: string;
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: unknown) {
  return `Rs ${num(value).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: unknown) {
  if (!value) return "—";

  const d = new Date(String(value));

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function extractAccounts(data: any): Account[] {
  const list = Array.isArray(data?.accounts)
    ? data.accounts
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

  return list
    .map((a: any) => ({
      id: String(a?.id ?? a?.accountId ?? ""),
      code: a?.code ?? a?.accountCode ?? "",
      accountCode: a?.accountCode ?? a?.code ?? "",
      name: a?.name ?? a?.accountName ?? "Unnamed Account",
      accountName: a?.accountName ?? a?.name ?? "Unnamed Account",
      type: a?.type ?? a?.accountType ?? "",
      accountType: a?.accountType ?? a?.type ?? "",
      isActive: a?.isActive !== false,
      description: a?.description ?? null,
    }))
    .filter((a: Account) => a.id && a.isActive);
}

function extractLedger(data: any): LedgerRow[] {
  const list = Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data?.ledger)
      ? data.ledger
      : Array.isArray(data?.transactions)
        ? data.transactions
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];

  return list;
}

export default function AccountsDashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const [accountError, setAccountError] = useState("");
  const [ledgerError, setLedgerError] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const debitTotal = useMemo(
    () => ledger.reduce((sum, row) => sum + num(row.debit), 0),
    [ledger]
  );

  const creditTotal = useMemo(
    () => ledger.reduce((sum, row) => sum + num(row.credit), 0),
    [ledger]
  );

  const closingBalance = useMemo(() => {
    if (!ledger.length) return 0;

    const last = ledger[ledger.length - 1];

    if (last.balance !== undefined && last.balance !== null) {
      return num(last.balance);
    }

    if (
      last.runningBalance !== undefined &&
      last.runningBalance !== null
    ) {
      return num(last.runningBalance);
    }

    return debitTotal - creditTotal;
  }, [ledger, debitTotal, creditTotal]);

  async function loadAccounts() {
    try {
      setLoadingAccounts(true);
      setAccountError("");

      const response = await fetch("/api/accounts", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to load accounts.");
      }

      const list = extractAccounts(data);

      setAccounts(list);

      if (list.length && !selectedAccountId) {
        setSelectedAccountId(list[0].id);
      }
    } catch (error) {
      console.error(error);
      setAccountError(
        error instanceof Error
          ? error.message
          : "Failed to load accounts."
      );
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function loadLedger(accountId = selectedAccountId) {
    if (!accountId) {
      setLedger([]);
      return;
    }

    try {
      setLoadingLedger(true);
      setLedgerError("");

      const params = new URLSearchParams();

      params.set("accountId", accountId);

      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(
        `/api/reports/general-ledger?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Failed to load account ledger."
        );
      }

      setLedger(extractLedger(data));
    } catch (error) {
      console.error(error);
      setLedger([]);
      setLedgerError(
        error instanceof Error
          ? error.message
          : "Failed to load account ledger."
      );
    } finally {
      setLoadingLedger(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadLedger(selectedAccountId);
    }
  }, [selectedAccountId]);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1500px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          marginBottom: "22px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#667085",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              marginBottom: "6px",
            }}
          >
            ACCOUNTING / GENERAL LEDGER
          </div>

          <h1
            style={{
              margin: 0,
              color: "#172033",
              fontSize: "28px",
              fontWeight: 800,
            }}
          >
            Chart of Accounts
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#667085",
              fontSize: "13px",
            }}
          >
            Select an account to view its complete ledger and running balance.
          </p>
        </div>

        <button
          onClick={() => {
            window.location.href = "/accounts/new";
          }}
          style={{
            border: "none",
            background: "#111827",
            color: "#ffffff",
            borderRadius: "9px",
            padding: "10px 15px",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          + New Account
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px minmax(0, 1fr)",
          minHeight: "680px",
          border: "1px solid #e4e8ef",
          borderRadius: "14px",
          overflow: "hidden",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #e4e8ef",
            background: "#fbfcfe",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "17px",
              borderBottom: "1px solid #e4e8ef",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#667085",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Active Accounts
            </div>

            <div
              style={{
                marginTop: "4px",
                fontSize: "12px",
                color: "#98a2b3",
              }}
            >
              {accounts.length} active account
              {accounts.length === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              overflowY: "auto",
              flex: 1,
            }}
          >
            {loadingAccounts ? (
              <div
                style={{
                  padding: "30px 18px",
                  color: "#667085",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                Loading accounts...
              </div>
            ) : accountError ? (
              <div
                style={{
                  padding: "18px",
                  color: "#b42318",
                  fontSize: "12px",
                }}
              >
                {accountError}
              </div>
            ) : accounts.length === 0 ? (
              <div
                style={{
                  padding: "30px 18px",
                  color: "#667085",
                  fontSize: "12px",
                  textAlign: "center",
                }}
              >
                No active accounts found.
              </div>
            ) : (
              accounts.map((account) => {
                const active = account.id === selectedAccountId;

                return (
                  <button
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    style={{
                      width: "100%",
                      border: "none",
                      borderBottom: "1px solid #edf0f5",
                      background: active ? "#f0ebf8" : "#ffffff",
                      textAlign: "left",
                      padding: "13px 15px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: active ? "#6f5599" : "#667085",
                        }}
                      >
                        {account.code || account.accountCode || "—"}
                      </span>

                      <span
                        style={{
                          fontSize: "10px",
                          color: "#98a2b3",
                          textTransform: "uppercase",
                        }}
                      >
                        {account.type || account.accountType || ""}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "13px",
                        fontWeight: active ? 800 : 650,
                        color: active ? "#6f5599" : "#172033",
                      }}
                    >
                      {account.name || account.accountName}
                    </div>

                    {account.description && (
                      <div
                        style={{
                          marginTop: "3px",
                          color: "#98a2b3",
                          fontSize: "10px",
                        }}
                      >
                        {account.description}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main
          style={{
            minWidth: 0,
            background: "#ffffff",
          }}
        >
          {!selectedAccount ? (
            <div
              style={{
                minHeight: "680px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#667085",
                fontSize: "13px",
              }}
            >
              Select an account from the left.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #e4e8ef",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "15px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#667085",
                        fontWeight: 800,
                        marginBottom: "5px",
                      }}
                    >
                      {selectedAccount.code ||
                        selectedAccount.accountCode ||
                        "ACCOUNT"}
                    </div>

                    <h2
                      style={{
                        margin: 0,
                        fontSize: "22px",
                        color: "#172033",
                      }}
                    >
                      {selectedAccount.name ||
                        selectedAccount.accountName}
                    </h2>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "12px",
                        color: "#667085",
                      }}
                    >
                      {selectedAccount.type ||
                        selectedAccount.accountType ||
                        "Account"}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        minWidth: "130px",
                        padding: "10px 13px",
                        border: "1px solid #e5e9f0",
                        borderRadius: "9px",
                        background: "#fbfcfe",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#667085",
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        Total Debit
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontWeight: 800,
                          color: "#172033",
                        }}
                      >
                        {money(debitTotal)}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: "130px",
                        padding: "10px 13px",
                        border: "1px solid #e5e9f0",
                        borderRadius: "9px",
                        background: "#fbfcfe",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#667085",
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        Total Credit
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontWeight: 800,
                          color: "#172033",
                        }}
                      >
                        {money(creditTotal)}
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: "145px",
                        padding: "10px 13px",
                        border: "1px solid #ddd2ec",
                        borderRadius: "9px",
                        background: "#f7f3fb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#6f5599",
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        Closing Balance
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          fontWeight: 800,
                          color: "#6f5599",
                        }}
                      >
                        {money(closingBalance)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "15px 24px",
                  borderBottom: "1px solid #e4e8ef",
                  background: "#fbfcfe",
                  display: "flex",
                  alignItems: "end",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "10px",
                      fontWeight: 800,
                      color: "#667085",
                      marginBottom: "5px",
                      textTransform: "uppercase",
                    }}
                  >
                    From
                  </label>

                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    style={{
                      padding: "9px 11px",
                      border: "1px solid #d8dee8",
                      borderRadius: "8px",
                      fontSize: "12px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "10px",
                      fontWeight: 800,
                      color: "#667085",
                      marginBottom: "5px",
                      textTransform: "uppercase",
                    }}
                  >
                    To
                  </label>

                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    style={{
                      padding: "9px 11px",
                      border: "1px solid #d8dee8",
                      borderRadius: "8px",
                      fontSize: "12px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <button
                  onClick={() => loadLedger()}
                  disabled={loadingLedger}
                  style={{
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: loadingLedger
                      ? "not-allowed"
                      : "pointer",
                    opacity: loadingLedger ? 0.6 : 1,
                  }}
                >
                  {loadingLedger ? "Loading..." : "Apply Dates"}
                </button>

                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setTimeout(() => loadLedger(), 0);
                  }}
                  style={{
                    border: "1px solid #d8dee8",
                    background: "#ffffff",
                    color: "#344054",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reset
                </button>
              </div>

              {ledgerError && (
                <div
                  style={{
                    margin: "16px 24px",
                    padding: "12px 14px",
                    border: "1px solid #f1c0c0",
                    background: "#fff7f7",
                    borderRadius: "8px",
                    color: "#b42318",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {ledgerError}
                </div>
              )}

              {loadingLedger ? (
                <div
                  style={{
                    padding: "70px 24px",
                    textAlign: "center",
                    color: "#667085",
                    fontSize: "13px",
                  }}
                >
                  Loading ledger...
                </div>
              ) : ledger.length === 0 ? (
                <div
                  style={{
                    margin: "24px",
                    minHeight: "280px",
                    border: "1px dashed #d8dee8",
                    borderRadius: "12px",
                    background: "#fbfcfe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    color: "#667085",
                    fontSize: "13px",
                  }}
                >
                  No ledger transactions found for this account and date range.
                </div>
              ) : (
                <div
                  style={{
                    padding: "0 24px 24px",
                    overflowX: "auto",
                  }}
                >
                  <table className="erp-data-table">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #dfe4ec",
                        }}
                      >
                        {[
                          "Date",
                          "Journal #",
                          "Reference",
                          "Description",
                          "Debit",
                          "Credit",
                          "Running Balance",
                        ].map((heading) => (
                          <th
                            key={heading}
                            style={{
                              padding: "13px 9px",
                              textAlign:
                                heading === "Debit" ||
                                heading === "Credit" ||
                                heading === "Running Balance"
                                  ? "right"
                                  : "left",
                              color: "#667085",
                              fontSize: "10px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {ledger.map((row, index) => (
                        <tr
                          key={String(
                            row.id ??
                              `${row.date}-${row.journalNumber}-${index}`
                          )}
                          style={{
                            borderBottom: "1px solid #edf0f5",
                          }}
                        >
                          <td
                            style={{
                              padding: "11px 9px",
                              whiteSpace: "nowrap",
                              color: "#344054",
                            }}
                          >
                            {dateText(row.date ?? row.entryDate)}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              whiteSpace: "nowrap",
                              fontWeight: 650,
                              color: "#172033",
                            }}
                          >
                            {row.journalNumber ??
                              row.entryNumber ??
                              "—"}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              whiteSpace: "nowrap",
                              color: "#344054",
                            }}
                          >
                            {row.reference ?? "—"}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              color: "#344054",
                              minWidth: "230px",
                            }}
                          >
                            {row.description ?? "—"}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {money(row.debit)}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {money(row.credit)}
                          </td>

                          <td
                            style={{
                              padding: "11px 9px",
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 800,
                              color: "#172033",
                            }}
                          >
                            {money(
                              row.balance ??
                                row.runningBalance
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div
                    style={{
                      marginTop: "10px",
                      textAlign: "right",
                      color: "#98a2b3",
                      fontSize: "11px",
                    }}
                  >
                    Showing {ledger.length} transaction
                    {ledger.length === 1 ? "" : "s"}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
