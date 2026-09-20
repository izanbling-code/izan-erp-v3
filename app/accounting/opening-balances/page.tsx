"use client";

import { useEffect, useState } from "react";
import ERPShell from "@/app/components/erp-shell";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type BalanceRow = {
  accountId: string;
  debit: string;
  credit: string;
};

export default function OpeningBalancesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceDate, setBalanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [rows, setRows] = useState<BalanceRow[]>([
    { accountId: "", debit: "", credit: "" },
    { accountId: "", debit: "", credit: "" },
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      if (data.ok) {
        setAccounts(data.accounts || []);
      } else {
        setMessage({ text: data.error || "Failed to load accounts", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to connect to server.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const handleRowChange = (index: number, field: keyof BalanceRow, value: string) => {
    const updated = [...rows];
    updated[index][field] = value;

    if (field === "debit" && value && Number(value) > 0) {
      updated[index].credit = "";
    } else if (field === "credit" && value && Number(value) > 0) {
      updated[index].debit = "";
    }

    setRows(updated);
  };

  const addRow = () => {
    setRows([...rows, { accountId: "", debit: "", credit: "" }]);
  };

  const removeRow = (index: number) => {
    if (rows.length > 2) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const totalDebit = rows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);
  const isBalanced = difference <= 0.005 && totalDebit > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const validRows = rows.filter(
      (r) => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0)
    );

    if (validRows.length < 2) {
      setMessage({ text: "Please provide at least two valid rows.", type: "error" });
      return;
    }

    if (!isBalanced) {
      setMessage({
        text: `Opening balances must balance. Difference: PKR ${difference.toFixed(2)}`,
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/accounting/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balanceDate,
          rows: validRows.map((r) => ({
            accountId: r.accountId,
            debit: r.debit || "0",
            credit: r.credit || "0",
          })),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setMessage({ text: "Opening balances posted successfully!", type: "success" });
        setRows([
          { accountId: "", debit: "", credit: "" },
          { accountId: "", debit: "", credit: "" },
        ]);
      } else {
        setMessage({ text: data.error || "Failed to post opening balances.", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to submit request.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ERPShell title="Opening Balances">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Set Opening Balances</h1>
            <p className="text-sm text-gray-500">
              Initialize starting balances for assets, liabilities, and owner equity.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Effective Date</label>
            <input
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {message && (
          <div
            className={`p-4 rounded-md text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
          <table className="erp-data-table">
            <thead>
              <tr className="border-b text-xs uppercase text-gray-500">
                <th className="py-2 px-3">Account</th>
                <th className="py-2 px-3 w-40 text-right">Debit (PKR)</th>
                <th className="py-2 px-3 w-40 text-right">Credit (PKR)</th>
                <th className="py-2 px-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-2 px-3">
                    <select
                      value={row.accountId}
                      onChange={(e) => handleRowChange(index, "accountId", e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Select Account...</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.debit}
                      placeholder="0.00"
                      onChange={(e) => handleRowChange(index, "debit", e.target.value)}
                      className="w-full text-right border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.credit}
                      placeholder="0.00"
                      onChange={(e) => handleRowChange(index, "credit", e.target.value)}
                      className="w-full text-right border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length <= 2}
                      className="text-red-500 hover:text-red-700 disabled:opacity-30 text-sm font-semibold"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold text-sm">
                <td className="py-3 px-3">Totals</td>
                <td className="py-3 px-3 text-right">{totalDebit.toFixed(2)}</td>
                <td className="py-3 px-3 text-right">{totalCredit.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={addRow}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm px-4 py-2 rounded font-medium"
            >
              + Add Line
            </button>

            <div className="flex items-center gap-4">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  isBalanced ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isBalanced
                  ? "✓ Balanced"
                  : `Difference: PKR ${difference.toFixed(2)}`}
              </span>
              <button
                type="submit"
                disabled={!isBalanced || submitting || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2 rounded font-medium disabled:opacity-50"
              >
                {submitting ? "Posting..." : "Post Opening Balances"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ERPShell>
  );
}
