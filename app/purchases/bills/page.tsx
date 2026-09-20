"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ERPShell from "@/app/components/erp-shell";

type PurchaseBill = {
  id: string;
  billNo: string;
  billDate: string;
  dueDate: string | null;
  status: "DRAFT" | "POSTED" | "PARTIAL" | "PAID" | "VOID";
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  supplier: {
    id: string;
    name: string;
  };
  lines: {
    id: string;
    product: { name: string; sku: string };
    batch: { batchNumber: string };
    quantity: number;
    unitCost: number;
    total: number;
  }[];
};

function money(amount: number | string) {
  const n = Number(amount || 0);
  return `Rs ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PurchaseBillsPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadBills() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/purchases/bills?search=${encodeURIComponent(search)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setBills(data.bills || []);
      } else {
        setError(data.error || "Failed to load purchase bills");
      }
    } catch {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
  }, []);

  async function handlePostBill(id: string, billNo: string) {
    if (!window.confirm(`Post purchase bill "${billNo}"?\n\nThis will increment warehouse stock and write accounting entries to the General Ledger.`)) return;

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");
      const res = await fetch("/api/purchases/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "POST" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Bill ${billNo} posted successfully.`);
        await loadBills();
      } else {
        setError(data.error || "Failed to post bill.");
      }
    } catch {
      setError("Failed to execute action.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReverseBill(id: string, billNo: string) {
    const confirmed = window.confirm(
      `REVERSE PURCHASE BILL\n\nAre you sure you want to reverse bill "${billNo}"?\n\nThis will:\n1. Deduct the received stock from the warehouse.\n2. Create an exact reversing journal entry in the General Ledger.\n3. Mark this bill as VOID.`
    );
    if (!confirmed) return;

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");
      const res = await fetch("/api/purchases/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "REVERSE" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Bill ${billNo} was reversed successfully. Stock and ledger entries were restored.`);
        await loadBills();
      } else {
        setError(data.error || "Failed to reverse bill.");
      }
    } catch {
      setError("Failed to execute reversal.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteBill(id: string, billNo: string) {
    if (!window.confirm(`Delete draft bill "${billNo}"?`)) return;

    try {
      setActionLoading(id);
      setError("");
      setSuccess("");
      const res = await fetch(`/api/purchases/bills?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Draft bill ${billNo} deleted.`);
        await loadBills();
      } else {
        setError(data.error || "Failed to delete bill.");
      }
    } catch {
      setError("Failed to delete bill.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <ERPShell title="Purchase Bills">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Purchase Bills</h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage vendor procurement, batch receiving, and bill reversals.
            </p>
          </div>
          <Link
            href="/purchases/bills/new"
            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            + Create Purchase Bill
          </Link>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{error}</div>}
        {success && <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg">{success}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex gap-3">
            <input
              type="text"
              placeholder="Search by Bill # or Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadBills()}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-500 w-72"
            />
            <button onClick={loadBills} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-lg text-gray-700 transition">
              Search
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-data-table">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">Loading purchase bills...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">No purchase bills found.</td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-gray-800">{bill.billNo}</td>
                      <td className="py-3 px-4 text-gray-500">{new Date(bill.billDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-gray-700">{bill.supplier?.name}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900">{money(bill.total)}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{money(bill.balance)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bill.status === "POSTED"
                              ? "bg-green-100 text-green-700"
                              : bill.status === "DRAFT"
                              ? "bg-amber-100 text-amber-700"
                              : bill.status === "PAID"
                              ? "bg-blue-100 text-blue-700"
                              : bill.status === "VOID"
                              ? "bg-gray-100 text-gray-500 line-through"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {bill.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => handlePostBill(bill.id, bill.billNo)}
                              disabled={actionLoading === bill.id}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[11px] font-semibold transition"
                            >
                              Post
                            </button>
                            <button
                              onClick={() => handleDeleteBill(bill.id, bill.billNo)}
                              disabled={actionLoading === bill.id}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-red-50 text-red-600 rounded text-[11px] font-semibold transition"
                            >
                              Delete
                            </button>
                          </>
                        )}

                        {(bill.status === "POSTED" || bill.status === "PAID" || bill.status === "PARTIAL") && (
                          <button
                            onClick={() => handleReverseBill(bill.id, bill.billNo)}
                            disabled={actionLoading === bill.id}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-semibold transition"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ERPShell>
  );
}
