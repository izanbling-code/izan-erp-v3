"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { 
  BookOpen, Search, Plus, CheckCircle2, XCircle, 
  AlertCircle, Loader2, Edit, Trash2, Lock, X 
} from "lucide-react";

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
  debit: string | number;
  credit: string | number;
  account?: Account;
};

type JournalEntry = {
  id: string;
  entryNo: string;
  entryDate: string;
  reference: string | null;
  description: string | null;
  status: "DRAFT" | "POSTED" | "VOID";
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
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  
  // Modals state
  const [showForm, setShowForm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<FormLine[]>([blankLine(), blankLine()]);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const cleanEntryNumber = (no: string | null | undefined) => no ? no.replace(/-\d{4}-/, '-').replace(/-0+(?=\d)/g, '-') : '—';

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      // 1. Get Company
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      if (!company) throw new Error("Company not found.");

      // 2. Fetch Accounts
      const { data: accData } = await supabase
        .from("Account")
        .select("id, code, name, type")
        .eq("companyId", company.id)
        .order("code", { ascending: true });
      
      const accountList = accData || [];
      if (accData) setAccounts(accData);

      // 3. Fetch Journal Entries (WITHOUT the Account join to bypass Supabase bug)
      const { data: jeData, error: jeError } = await supabase
        .from("JournalEntry")
        .select(`
          *,
          lines:JournalLine(*)
        `)
        .eq("companyId", company.id)
        .order("entryDate", { ascending: false });

      if (jeError) throw jeError;
      
      // 4. ✅ MANUALLY MAP THE ACCOUNT TO EACH LINE (Bulletproof fix)
      const formattedData = (jeData || []).map((e: any) => ({
        ...e,
        entryNumber: e.entryNo,
        lines: (e.lines || []).map((l: any) => ({
          ...l,
          account: accountList.find((a: any) => a.id === l.accountId) || null
        }))
      }));

      setEntries(formattedData);
    } catch (err: any) {
      setError(err.message || "Failed to load journal entries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSearch = 
        e.entryNo?.toLowerCase().includes(search.toLowerCase()) ||
        e.reference?.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase());
      
      const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
      
      return matchSearch && matchStatus;
    });
  }, [entries, search, statusFilter]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return {
      debit,
      credit,
      difference: debit - credit,
      balanced: debit > 0 && credit > 0 && Math.abs(debit - credit) <= 0.005,
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
    if (entry.status !== "DRAFT") return alert("Only drafts can be edited.");
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

  function updateLine(index: number, field: keyof FormLine, value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (field === "debit" && Number(value) > 0) return { ...line, debit: value, credit: "" };
        if (field === "credit" && Number(value) > 0) return { ...line, credit: value, debit: "" };
        return { ...line, [field]: value };
      })
    );
  }

  async function saveEntry(status: "DRAFT" | "POSTED") {
    if (lines.length < 2) return setError("A journal entry requires at least two lines.");
    if (status === "POSTED" && !totals.balanced) return setError("The journal entry must be balanced before posting.");
    
    const validLines = lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) return setError("Please fill at least two valid lines.");

    try {
      setSaving(true);
      setError("");

      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      const now = new Date().toISOString();
      const entryId = editingId || crypto.randomUUID();

      if (editingId) {
        await supabase.from("JournalEntry").update({
          entryDate, reference: reference || null, description: description || null, status, updatedAt: now
        }).eq("id", entryId);

        await supabase.from("JournalLine").delete().eq("journalEntryId", entryId);
      } else {
        await supabase.from("JournalEntry").insert({
          id: entryId,
          companyId: company!.id,
          entryNo: `JE-${Date.now().toString().slice(-6)}`,
          entryDate,
          reference: reference || null,
          description: description || null,
          status,
          createdAt: now,
          updatedAt: now
        });
      }

      const newLines = validLines.map(l => ({
        id: crypto.randomUUID(),
        journalEntryId: entryId,
        accountId: l.accountId,
        description: l.description || null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        createdAt: now,
        updatedAt: now
      }));

      const { error: lineError } = await supabase.from("JournalLine").insert(newLines);
      if (lineError) throw lineError;

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save entry.");
    } finally {
      setSaving(false);
    }
  }

  async function journalAction(entry: JournalEntry, action: "POST" | "VOID") {
    if (!window.confirm(`Are you sure you want to ${action} ${entry.entryNo}?`)) return;
    try {
      await supabase.from("JournalEntry").update({ status: action === "POST" ? "POSTED" : "VOID" }).eq("id", entry.id);
      setSelectedEntry(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteError("");
    setIsDeleting(true);

    try {
      const verifyRes = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: confirmPassword })
      });
      
      const resText = await verifyRes.text();
      let verifyData;
      try { verifyData = JSON.parse(resText); } catch { throw new Error("Server error: Security endpoint unreachable."); }
      
      if (!verifyRes.ok) throw new Error(verifyData.error || "Incorrect password");

      const { error: lineErr } = await supabase.from("JournalLine").delete().eq("journalEntryId", deleteTarget.id);
      if (lineErr) throw lineErr;

      const { error: entryErr } = await supabase.from("JournalEntry").delete().eq("id", deleteTarget.id);
      if (entryErr) throw entryErr;

      setDeleteTarget(null);
      setConfirmPassword("");
      setSelectedEntry(null);
      await loadData();

    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function formatAmount(value: string | number) {
    return Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function statusStyle(status: string) {
    if (status === "POSTED") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (status === "VOID") return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-500" /> Journal Entries
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Record and manage double-entry accounting transactions.</p>
        </div>
        <button onClick={openCreate} className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-teal-500/20">
          <Plus className="w-4 h-4" /> New Journal Entry
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Entries", value: stats.total, color: "text-white" },
          { label: "Draft", value: stats.drafts, color: "text-amber-400" },
          { label: "Posted", value: stats.posted, color: "text-emerald-400" },
          { label: "Void", value: stats.voided, color: "text-rose-400" },
        ].map((kpi, i) => (
          <div key={i} className="bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{kpi.label}</div>
            <div className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Main Table Panel */}
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        
        {/* Filters */}
        <div className="p-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between bg-black/20">
          <div className="flex flex-wrap gap-4 items-center flex-1">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entry number, reference..." className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-teal-500">
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="VOID">Void</option>
            </select>
            <button onClick={loadData} disabled={loading} className="px-4 py-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-4 rounded-xl flex items-center gap-3 text-sm bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-4" /> Loading entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-zinc-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">No journal entries found</h3>
            <p className="text-sm text-zinc-500">Create a journal entry to begin recording transactions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-950/50 border-b border-white/5 text-xs text-zinc-500 uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Entry #</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Debit</th>
                  <th className="px-6 py-4 text-right">Credit</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEntries.map((entry) => {
                  const debit = entry.lines.reduce((sum, line) => sum + Number(line.debit), 0);
                  const credit = entry.lines.reduce((sum, line) => sum + Number(line.credit), 0);

                  return (
                    <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-white">{cleanEntryNumber(entry.entryNo)}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{new Date(entry.entryDate).toLocaleDateString("en-PK")}</td>
                      <td className="px-6 py-4 text-sm text-zinc-400">{entry.reference || "—"}</td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{entry.description || "—"}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-white text-right">{formatAmount(debit)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-white text-right">{formatAmount(credit)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle(entry.status)}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setSelectedEntry(entry)} className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="View"><Search className="w-4 h-4" /></button>
                          
                          {entry.status === "DRAFT" && (
                            <>
                              <button onClick={() => openEdit(entry)} className="p-1.5 text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 rounded-md transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                              <button onClick={() => journalAction(entry, "POST")} className="p-1.5 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors" title="Post"><CheckCircle2 className="w-4 h-4" /></button>
                            </>
                          )}
                          
                          {entry.status === "POSTED" && (
                            <button onClick={() => journalAction(entry, "VOID")} className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors" title="Void"><XCircle className="w-4 h-4" /></button>
                          )}

                          <button onClick={() => { setDeleteTarget(entry); setConfirmPassword(""); setDeleteError(""); }} className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-white">{editingId ? "Edit Draft" : "New Journal Entry"}</h2>
                <p className="text-sm text-zinc-400 mt-1">Record a balanced double-entry transaction.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Entry Date *</label>
                  <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Reference</label>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. ADJ-001" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Description</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Journal description" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
                </div>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden mb-4">
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_40px] bg-zinc-950/80 border-b border-white/10 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                  <div className="p-3">Account</div>
                  <div className="p-3">Description</div>
                  <div className="p-3 text-right">Debit</div>
                  <div className="p-3 text-right">Credit</div>
                  <div></div>
                </div>

                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_40px] border-b border-white/5 bg-black/20">
                    <div className="p-2">
                      <select value={line.accountId} onChange={(e) => updateLine(index, "accountId", e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none">
                        <option value="">Select account...</option>
                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>)}
                      </select>
                    </div>
                    <div className="p-2">
                      <input value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} placeholder="Line description" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
                    </div>
                    <div className="p-2">
                      <input type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(index, "debit", e.target.value)} placeholder="0.00" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-right focus:border-teal-500 outline-none font-mono" />
                    </div>
                    <div className="p-2">
                      <input type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(index, "credit", e.target.value)} placeholder="0.00" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-right focus:border-teal-500 outline-none font-mono" />
                    </div>
                    <div className="flex items-center justify-center">
                      <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} disabled={lines.length <= 2} className="text-rose-400 disabled:text-zinc-700 hover:text-rose-300"><XCircle className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-start">
                <button type="button" onClick={() => setLines([...lines, blankLine()])} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add Line
                </button>

                <div className="w-72 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden">
                  <div className="flex justify-between p-3 border-b border-white/5 text-sm"><span className="text-zinc-500">Total Debit</span><span className="font-mono text-white font-semibold">{formatAmount(totals.debit)}</span></div>
                  <div className="flex justify-between p-3 border-b border-white/5 text-sm"><span className="text-zinc-500">Total Credit</span><span className="font-mono text-white font-semibold">{formatAmount(totals.credit)}</span></div>
                  <div className={`flex justify-between p-3 text-sm font-bold ${totals.balanced ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}><span>{totals.balanced ? "Balanced" : "Difference"}</span><span className="font-mono">{formatAmount(Math.abs(totals.difference))}</span></div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5">Cancel</button>
              <button onClick={() => saveEntry("DRAFT")} disabled={saving} className="px-5 py-2.5 rounded-lg border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10">{saving ? "Saving..." : "Save Draft"}</button>
              <button onClick={() => saveEntry("POSTED")} disabled={saving || !totals.balanced} className="px-6 py-2.5 rounded-lg bg-teal-500 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-50 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {saving ? "Posting..." : "Post Entry"}</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ENTRY MODAL */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-black/20">
              <div>
                <h2 className="text-xl font-bold text-white">{cleanEntryNumber(selectedEntry.entryNo)}</h2>
                <p className="text-sm text-zinc-400 mt-1">{new Date(selectedEntry.entryDate).toLocaleDateString("en-PK")} • {selectedEntry.reference || "No reference"}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6">
              {selectedEntry.description && <div className="mb-6 p-4 bg-zinc-950 rounded-xl border border-white/5 text-sm text-zinc-300">{selectedEntry.description}</div>}
              <div className="border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-950 border-b border-white/10 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                    <tr><th className="px-4 py-3">Account</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedEntry.lines.map((line) => (
                      <tr key={line.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 text-sm text-white font-medium">{line.account?.code || "—"} — {line.account?.name || "Unknown"}</td>
                        <td className="px-4 py-3 text-sm text-zinc-400">{line.description || "—"}</td>
                        <td className="px-4 py-3 text-sm font-mono text-white text-right">{formatAmount(line.debit)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-white text-right">{formatAmount(line.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${statusStyle(selectedEntry.status)}`}>{selectedEntry.status}</span>
              <div className="flex gap-3">
                <button onClick={() => setSelectedEntry(null)} className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECURE DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Journal Entry</h2>
              <p className="text-sm text-zinc-400 mb-6">
                You are about to permanently delete <strong className="text-white">{deleteTarget.entryNo}</strong> and all its associated lines. This action cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-semibold">
                  {deleteError}
                </div>
              )}

              <form onSubmit={handleDelete} className="space-y-4">
                <div className="text-left">
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="password"
                      required
                      autoFocus
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white outline-none focus:border-rose-500 transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors">Cancel</button>
                  <button type="submit" disabled={isDeleting || !confirmPassword} className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Delete"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}