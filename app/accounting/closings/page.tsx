"use client";

import { useEffect, useState } from "react";
import ERPShell from "@/app/components/erp-shell";

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "LOCKED" | "CLOSED";
  closedAt: string | null;
  closedBy: string | null;
};

export default function MonthlyClosingsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [success, setSuccess] = useState("");
  const [processing, setProcessing] = useState("");

  async function loadPeriods() {
    try {
      setLoading(true);
      setError("");
      setErrorDetails([]);
      const res = await fetch("/api/accounting/periods", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Failed to load periods");
      setPeriods(json.periods || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

  async function updatePeriodStatus(periodId: string, status: "OPEN" | "LOCKED" | "CLOSED") {
    const actionName = status === "CLOSED" ? "close" : status === "LOCKED" ? "lock" : "reopen";
    if (!window.confirm(`Are you sure you want to ${actionName} this fiscal period?`)) return;

    try {
      setProcessing(periodId);
      setError("");
      setErrorDetails([]);
      setSuccess("");

      const res = await fetch("/api/accounting/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, status }),
      });

      const json = await res.json();
      
      // 🛡️ NEW: Catch advanced validation errors and details array
      if (!res.ok || !json.ok) {
        if (json.details) setErrorDetails(json.details);
        throw new Error(json.error || "Failed to update period");
      }

      setSuccess(json.message);
      await loadPeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update period");
    } finally {
      setProcessing("");
    }
  }

  return (
    <ERPShell>
      <div className="max-w-6xl mx-auto p-6 space-y-6 text-xs">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-base font-bold text-gray-900">Fiscal Periods & Monthly Closings</h1>
            <p className="text-gray-500 mt-0.5">Manage accounting periods, lock historical records, and enforce period closing.</p>
          </div>
          <button
            onClick={loadPeriods}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-semibold transition"
          >
            ↻ Refresh Periods
          </button>
        </div>

        {/* 🚨 UPGRADED: Validation Error Alert Box */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg shadow-sm">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⚠️</span>
              <span className="font-bold text-sm">{error}</span>
            </div>
            {errorDetails.length > 0 && (
              <ul className="mt-3 ml-7 list-disc text-red-700 font-medium space-y-1">
                {errorDetails.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        
        {success && <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium">{success}</div>}

        {/* Periods Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400 font-semibold">Loading fiscal periods...</div>
          ) : (
            <table className="erp-data-table">
              <thead>
                <tr className="border-b bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
                  <th className="py-3 px-4">Period Name</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">End Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Closed Details</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {periods.map((p) => {
                  const isClosed = p.status === "CLOSED";
                  const isLocked = p.status === "LOCKED";
                  const isOpen = p.status === "OPEN";

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-bold text-gray-900">{p.name}</td>
                      <td className="py-2.5 px-4 text-gray-600">{new Date(p.startDate).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4 text-gray-600">{new Date(p.endDate).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          isOpen ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          isLocked ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          "bg-rose-50 text-rose-700 border border-rose-200"
                        }>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">
                        {isClosed ? `${p.closedBy || "Admin"} on ${new Date(p.closedAt!).toLocaleDateString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {isOpen && (
                          <>
                            <button
                              disabled={processing === p.id}
                              onClick={() => updatePeriodStatus(p.id, "LOCKED")}
                              className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md font-bold transition"
                            >
                              Lock
                            </button>
                            <button
                              disabled={processing === p.id}
                              onClick={() => updatePeriodStatus(p.id, "CLOSED")}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold transition"
                            >
                              Close Month
                            </button>
                          </>
                        )}
                        {isLocked && (
                          <>
                            <button
                              disabled={processing === p.id}
                              onClick={() => updatePeriodStatus(p.id, "OPEN")}
                              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-bold transition"
                            >
                              Reopen
                            </button>
                            <button
                              disabled={processing === p.id}
                              onClick={() => updatePeriodStatus(p.id, "CLOSED")}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold transition"
                            >
                              Close Month
                            </button>
                          </>
                        )}
                        {isClosed && (
                          <button
                            disabled={processing === p.id}
                            onClick={() => updatePeriodStatus(p.id, "OPEN")}
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-bold transition"
                          >
                            Unlock & Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ERPShell>
  );
}