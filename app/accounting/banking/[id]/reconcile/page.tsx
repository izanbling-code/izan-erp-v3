"use client";

import { useEffect, useState, ChangeEvent, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  ArrowLeft,
  Upload,
  Zap,
  Lock,
  Plus,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Database,
} from "lucide-react";

type ERPTx = {
  id: string;
  transactionDate: string;
  reference: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  status: string;
  net: number;
};

type StatementLine = {
  id: string;
  date: string;
  description: string;
  amount: number;
  matchedToId: string | null;
};

type Account = {
  id: string;
  name: string;
  systemCode: string;
  code?: string;
};

export default function BankReconciliationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { formatAmount, currency } = useERPConfig();

  const [bank, setBank] = useState<any>(null);
  const [glAccounts, setGlAccounts] = useState<Account[]>([]);
  const [erpTransactions, setErpTransactions] = useState<ERPTx[]>([]);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Manual Matching State
  const [selectedCsvId, setSelectedCsvId] = useState<string | null>(null);

  // Quick Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    date: "",
    description: "",
    amount: 0,
    offsetAccountId: "",
    lineId: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [bankRes, glRes] = await Promise.all([
          fetch(`/api/banking/accounts/${id}`),
          fetch(`/api/accounting/cashbook/accounts`),
        ]);
        const bankJson = await bankRes.json();
        const glJson = await glRes.json();

        if (bankJson.ok) {
          setBank(bankJson.bankAccount);
          const unreconciled = (bankJson.transactions || [])
            .filter((tx: any) => tx.status !== "RECONCILED")
            .map((tx: any) => ({ ...tx, net: Number(tx.moneyIn) - Number(tx.moneyOut) }));
          setErpTransactions(unreconciled);
        }
        if (glJson.ok) setGlAccounts(glJson.accounts || []);
      } catch {
        toast.error("Failed to load reconciliation data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setSelectedCsvId(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split("\n").map((r) => r.split(","));
        const parsed = rows
          .slice(1)
          .map((r, i) => {
            if (r.length < 3) return null;
            const amt = parseFloat(r[2].replace(/[^0-9.-]+/g, ""));
            if (isNaN(amt)) return null;
            return {
              id: `stm-${i}`,
              date: r[0].trim(),
              description: r[1].trim(),
              amount: amt,
              matchedToId: null,
            };
          })
          .filter(Boolean) as StatementLine[];
        setStatementLines(parsed);
        toast.success(`Loaded ${parsed.length} statement lines.`);
      } catch {
        setUploadError("Invalid CSV format. Columns must be: Date, Description, Amount.");
        toast.error("Invalid CSV format.");
      }
    };
    reader.readAsText(file);
  };

  const runAutoMatch = () => {
    const newErp = [...erpTransactions];
    const newLines = [...statementLines];
    let matchesFound = 0;

    newLines.forEach((line) => {
      if (line.matchedToId) return;
      const matchIdx = newErp.findIndex((erp) => erp.net === line.amount && !erp.status.includes("MATCHED"));
      if (matchIdx !== -1) {
        line.matchedToId = newErp[matchIdx].id;
        newErp[matchIdx].status = "MATCHED";
        matchesFound++;
      }
    });

    setStatementLines(newLines);
    setErpTransactions(newErp);
    toast.success(`Auto-matched ${matchesFound} transaction(s)!`);
  };

  const handleCsvClick = (line: StatementLine) => {
    if (line.matchedToId) return;
    setSelectedCsvId(selectedCsvId === line.id ? null : line.id);
  };

  const handleErpClick = (tx: ERPTx) => {
    if (!selectedCsvId || tx.status.includes("MATCHED")) return;

    const newLines = [...statementLines];
    const newErp = [...erpTransactions];

    const lineIdx = newLines.findIndex((l) => l.id === selectedCsvId);
    const erpIdx = newErp.findIndex((e) => e.id === tx.id);

    newLines[lineIdx].matchedToId = newErp[erpIdx].id;
    newErp[erpIdx].status = "MATCHED";

    setStatementLines(newLines);
    setErpTransactions(newErp);
    setSelectedCsvId(null);
  };

  const unmatch = (lineId: string, erpId: string) => {
    const newLines = [...statementLines];
    const newErp = [...erpTransactions];

    const lineIdx = newLines.findIndex((l) => l.id === lineId);
    const erpIdx = newErp.findIndex((e) => e.id === erpId);

    if (lineIdx > -1) newLines[lineIdx].matchedToId = null;
    if (erpIdx > -1) newErp[erpIdx].status = "PENDING";

    setStatementLines(newLines);
    setErpTransactions(newErp);
  };

  const openAddModal = (line: StatementLine) => {
    setAddForm({
      date: line.date,
      description: line.description,
      amount: line.amount,
      offsetAccountId: "",
      lineId: line.id,
    });
    setShowAddModal(true);
  };

  const submitQuickAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isMoneyIn = addForm.amount > 0;
      const res = await fetch(`/api/banking/accounts/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, isMoneyIn }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      const newTx = {
        ...json.transaction,
        net: Number(json.transaction.moneyIn || 0) - Number(json.transaction.moneyOut || 0),
        status: "MATCHED",
      };
      const newErp = [newTx, ...erpTransactions];
      const newLines = [...statementLines];

      const lineIdx = newLines.findIndex((l) => l.id === addForm.lineId);
      if (lineIdx > -1) newLines[lineIdx].matchedToId = newTx.id;

      setErpTransactions(newErp);
      setStatementLines(newLines);
      setShowAddModal(false);
      toast.success("Adjustment posted and matched!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post adjustment.");
    } finally {
      setSaving(false);
    }
  };

  const commitReconciliation = async () => {
    const matchedTxIds = erpTransactions.filter((tx) => tx.status === "MATCHED").map((tx) => tx.id);
    if (matchedTxIds.length === 0) {
      toast.error("No transactions matched to reconcile.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/banking/accounts/${id}/reconcile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedTxIds }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success(`${matchedTxIds.length} transactions permanently reconciled!`);
      router.push(`/accounting/banking/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save reconciliation.");
      setSaving(false);
    }
  };

  const displayCurrency = bank?.currency || currency || "PKR";
  const matchedCount = statementLines.filter((l) => l.matchedToId).length;

  if (loading) {
    return (
      <ERPShell title="Bank Reconciliation">
        <div className="py-20 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium">
          Loading Auto-Reconciler...
        </div>
      </ERPShell>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Bank Statement Reconciliation">
        <div className="space-y-6 relative z-10">
          {/* Top Header & CSV Upload */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <Link
                href={`/accounting/banking/${id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to {bank?.bankName || "Bank"} Control Panel
              </Link>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Statement Reconciler: {bank?.bankName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Upload your bank CSV (Date, Description, Amount) to auto-match, manually link, or post missing ledger entries.
              </p>
            </div>

            <label className="cursor-pointer px-4 py-3 rounded-xl border border-dashed border-teal-400 dark:border-teal-500/40 bg-teal-50/50 dark:bg-teal-500/10 hover:bg-teal-50 dark:hover:bg-teal-500/20 flex items-center gap-3 transition-all">
              <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-teal-700 dark:text-teal-300 block">Upload Statement CSV</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">Columns: Date, Description, Amount</span>
              </div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {uploadError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold">
              {uploadError}
            </div>
          )}

          {/* Reconciliation Progress & Action Bar */}
          {statementLines.length > 0 && (
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600 dark:text-zinc-300">
                  Loaded Statement Lines:{" "}
                  <strong className="text-slate-900 dark:text-white">{statementLines.length}</strong>
                </span>
                <span>•</span>
                <span className="text-slate-600 dark:text-zinc-300">
                  Matched:{" "}
                  <strong className="text-teal-600 dark:text-teal-400">
                    {matchedCount} / {statementLines.length}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={runAutoMatch}
                  className="px-4 py-2.5 rounded-xl border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 hover:bg-teal-600 hover:text-white text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Zap className="w-4 h-4" /> Run Auto-Match
                </button>

                <button
                  type="button"
                  onClick={commitReconciliation}
                  disabled={saving || matchedCount === 0}
                  className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  {saving ? "Committing..." : `Lock & Commit (${matchedCount})`}
                </button>
              </div>
            </div>
          )}

          {/* Side-by-Side Split Reconciler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: BANK STATEMENT CSV */}
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden flex flex-col h-[600px]">
              <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  1. Bank Statement Lines (CSV)
                </h3>
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-2.5 custom-scrollbar">
                {statementLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-zinc-500 text-xs space-y-1">
                    <Upload className="w-6 h-6 mb-1 opacity-50" />
                    <p className="font-semibold">No CSV Statement Uploaded</p>
                    <p>Click &ldquo;Upload Statement CSV&rdquo; above to begin matching.</p>
                  </div>
                ) : (
                  statementLines.map((line) => (
                    <div
                      key={line.id}
                      onClick={() => handleCsvClick(line)}
                      className={`p-3.5 rounded-xl border text-xs flex justify-between items-center transition-all ${
                        line.matchedToId
                          ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 opacity-75"
                          : selectedCsvId === line.id
                          ? "bg-teal-50 dark:bg-teal-500/20 border-teal-500 ring-2 ring-teal-500/20 cursor-pointer"
                          : "bg-white dark:bg-zinc-950/60 border-slate-200 dark:border-white/10 hover:border-teal-400 cursor-pointer"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{line.date}</div>
                        <div className="text-slate-500 dark:text-zinc-400 mt-0.5">{line.description}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div
                            className={`font-bold ${
                              line.amount > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {displayCurrency} {formatAmount(line.amount)}
                          </div>
                          {line.matchedToId && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Matched
                            </span>
                          )}
                        </div>

                        {!line.matchedToId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddModal(line);
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-teal-600 hover:text-white text-slate-700 dark:text-zinc-200 flex items-center justify-center transition-all"
                            title="Quick-Add Missing Entry to ERP"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}

                        {line.matchedToId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              unmatch(line.id, line.matchedToId as string);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-600 hover:text-white transition-all"
                            title="Unmatch"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: ERP SUBLEDGER */}
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden flex flex-col h-[600px]">
              <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    2. ERP Subledger (Unreconciled)
                  </h3>
                </div>
                {selectedCsvId && (
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/20 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-500/30 animate-pulse">
                    Click an ERP transaction below to link
                  </span>
                )}
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-2.5 custom-scrollbar">
                {erpTransactions.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-zinc-500 text-xs">
                    No unreconciled ERP transactions found.
                  </div>
                ) : (
                  erpTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => handleErpClick(tx)}
                      className={`p-3.5 rounded-xl border text-xs flex justify-between items-center transition-all ${
                        tx.status === "MATCHED"
                          ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 opacity-75"
                          : selectedCsvId
                          ? "bg-white dark:bg-zinc-950/60 border-teal-300 dark:border-teal-500/40 hover:bg-teal-50/50 dark:hover:bg-teal-500/10 cursor-pointer shadow-sm"
                          : "bg-white dark:bg-zinc-950/60 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {new Date(tx.transactionDate).toISOString().slice(0, 10)} — {tx.reference || "No Ref"}
                        </div>
                        <div className="text-slate-500 dark:text-zinc-400 mt-0.5">{tx.description}</div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-bold ${
                            tx.net > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {displayCurrency} {formatAmount(tx.net)}
                        </div>
                        {tx.status === "MATCHED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Matched
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase block mt-0.5">
                            {tx.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ON-THE-FLY ADJUSTMENT MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Missing Transaction</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Posts a General Ledger entry and links it to this statement line.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitQuickAdd} className="space-y-4 text-sm">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Statement Description *
                  </label>
                  <input
                    required
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={addForm.date}
                      onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Amount ({displayCurrency})
                    </label>
                    <input
                      type="number"
                      value={addForm.amount}
                      disabled
                      className={`w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none ${
                        addForm.amount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                    Offset Account (Chart of Accounts) *
                  </label>
                  <select
                    required
                    value={addForm.offsetAccountId}
                    onChange={(e) => setAddForm({ ...addForm, offsetAccountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="">-- Select GL Account --</option>
                    {glAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code ? `${acc.code} — ` : ""}
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Posting..." : "Post & Match"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}