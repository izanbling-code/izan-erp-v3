"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { Scale, Calendar, ArrowRightLeft, CheckCircle2, AlertCircle, Loader2, Info, Lock, X } from "lucide-react";

type Account = {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY";
};

export default function OpeningBalancesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Security Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    async function loadAccounts() {
      try {
        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        if (!company) return;

        const { data, error } = await supabase
          .from("Account")
          .select("id, code, name, type")
          .eq("companyId", company.id)
          .in("type", ["ASSET", "LIABILITY", "EQUITY"])
          .order("code", { ascending: true });

        if (data) setAccounts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const isDebitNormal = selectedAccount?.type === "ASSET";
  const numAmount = Number(amount) || 0;

  const setToFirstOfMonth = () => {
    const d = new Date(balanceDate);
    d.setDate(1);
    setBalanceDate(d.toISOString().split("T")[0]);
  };

  function handleInitialSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!selectedAccountId || numAmount <= 0) {
      setMessage({ text: "Please select an account and enter a valid amount.", type: "error" });
      return;
    }
    setConfirmPassword("");
    setModalError("");
    setShowPasswordModal(true);
  }

  async function handleVerifyAndPost(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);

    try {
      // 1. Verify the user's password via the API
      const verifyRes = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: confirmPassword })
      });

      const resText = await verifyRes.text();
      let verifyData;
      try {
        verifyData = JSON.parse(resText);
      } catch {
        throw new Error("Server error: The security endpoint could not be reached.");
      }

      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Incorrect password");
      }

      // 2. Proceed with posting to Supabase
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      if (!company) throw new Error("Company not found.");

      let equityAccountId = "";
      const { data: eqAccount } = await supabase
        .from("Account")
        .select("id")
        .eq("companyId", company.id)
        .ilike("name", "%Opening Balance Equity%")
        .maybeSingle();

      if (eqAccount) {
        equityAccountId = eqAccount.id;
      } else {
        const { data: newEq } = await supabase.from("Account").insert({
          companyId: company.id,
          code: "3999",
          name: "Opening Balance Equity",
          type: "EQUITY",
        }).select("id").single();
        if (newEq) equityAccountId = newEq.id;
      }

      if (!equityAccountId) throw new Error("Failed to create/find Opening Balance Equity account.");

      const entryId = crypto.randomUUID();
      const line1Id = crypto.randomUUID();
      const line2Id = crypto.randomUUID();
      
      // ✅ FIX: Generate the timestamp manually since Supabase bypasses Prisma
      const now = new Date().toISOString(); 

      // Step A: Create the Journal Entry
      const { error: jeError } = await supabase
        .from("JournalEntry")
        .insert({
          id: entryId,
          companyId: company.id,
          entryNo: `OB-${Date.now().toString().slice(-6)}`,
          entryDate: balanceDate,
          description: `Opening Balance for ${selectedAccount?.name}`,
          status: "POSTED",
          createdAt: now, // ✅ Explicitly set
          updatedAt: now, // ✅ Explicitly set
        });

      if (jeError) throw new Error(`Failed to create Journal Entry: ${jeError.message}`);

      // Step B: Create the two Journal Lines
      const { error: jlError } = await supabase
        .from("JournalLine")
        .insert([
          { 
            id: line1Id,
            journalEntryId: entryId, 
            accountId: selectedAccountId, 
            debit: isDebitNormal ? numAmount : 0, 
            credit: isDebitNormal ? 0 : numAmount,
            createdAt: now, // ✅ Explicitly set
            updatedAt: now, // ✅ Explicitly set
          },
          { 
            id: line2Id,
            journalEntryId: entryId, 
            accountId: equityAccountId, 
            debit: isDebitNormal ? 0 : numAmount, 
            credit: isDebitNormal ? numAmount : 0,
            createdAt: now, // ✅ Explicitly set
            updatedAt: now, // ✅ Explicitly set
          }
        ]);

      if (jlError) throw new Error(`Failed to create Journal Lines: ${jlError.message}`);

      // Success
      setMessage({ text: "Opening balance posted successfully! It will appear as the first entry.", type: "success" });
      setSelectedAccountId("");
      setAmount("");
      setShowPasswordModal(false);
      
    } catch (err: any) {
      setModalError(err.message || "Failed to post opening balance.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-teal-500" /> Opening Balances
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Initialize starting balances. This creates the first journal entry.</p>
        </div>
        
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3 bg-zinc-950 px-4 py-2 rounded-xl border border-white/10">
            <Calendar className="w-5 h-5 text-zinc-500" />
            <input
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              className="bg-transparent text-sm text-white outline-none [color-scheme:dark]"
            />
          </div>
          <button 
            type="button" 
            onClick={setToFirstOfMonth}
            className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold uppercase tracking-wider"
          >
            Set to 1st of Month
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
          message.type === "success" 
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
            : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
        }`}>
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Panel */}
        <form onSubmit={handleInitialSubmit} className="lg:col-span-2 bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 space-y-6">
          
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Select Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => { setSelectedAccountId(e.target.value); setMessage(null); }}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-teal-500 transition-all appearance-none"
            >
              <option value="">Choose an account...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Opening Amount (PKR)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setMessage(null); }}
              placeholder="0.00"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3.5 text-lg font-mono text-white placeholder:text-zinc-700 outline-none focus:border-teal-500 transition-all"
            />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-300/80 leading-relaxed">
              To ensure this appears as the very first entry in your ledger, make sure the date is set to the beginning of your fiscal period.
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedAccountId || numAmount <= 0}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Post Opening Balance
          </button>
        </form>

        {/* Live Preview Panel */}
        <div className="bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-bl-full pointer-events-none" />
           
           <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
             <ArrowRightLeft className="w-4 h-4 text-teal-400" />
             Auto-Entry Preview
           </h3>

           {!selectedAccountId ? (
             <p className="text-xs text-zinc-500 leading-relaxed">
               Select an account to see how the system will automatically balance the journal entry.
             </p>
           ) : (
             <div className="space-y-4">
                <div className="p-3 bg-zinc-950 rounded-lg border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Selected Account</p>
                  <p className="text-sm font-semibold text-white truncate">{selectedAccount?.name}</p>
                  <div className="flex justify-between mt-2 text-xs font-mono">
                     <span className="text-zinc-400">Debit:</span>
                     <span className={isDebitNormal && numAmount > 0 ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                        {isDebitNormal ? numAmount.toLocaleString() : "0.00"}
                     </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                     <span className="text-zinc-400">Credit:</span>
                     <span className={!isDebitNormal && numAmount > 0 ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                        {!isDebitNormal ? numAmount.toLocaleString() : "0.00"}
                     </span>
                  </div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-lg border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Balancing Account</p>
                  <p className="text-sm font-semibold text-white truncate">Opening Balance Equity</p>
                  <div className="flex justify-between mt-2 text-xs font-mono">
                     <span className="text-zinc-400">Debit:</span>
                     <span className={!isDebitNormal && numAmount > 0 ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                        {!isDebitNormal ? numAmount.toLocaleString() : "0.00"}
                     </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                     <span className="text-zinc-400">Credit:</span>
                     <span className={isDebitNormal && numAmount > 0 ? "text-emerald-400 font-bold" : "text-zinc-600"}>
                        {isDebitNormal ? numAmount.toLocaleString() : "0.00"}
                     </span>
                  </div>
                </div>
             </div>
           )}
        </div>
      </div>

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h2 className="text-xl font-bold text-white mb-2">Security Confirmation</h2>
              <p className="text-sm text-zinc-400 mb-6">
                You are about to post a permanent opening balance of <strong className="text-white">PKR {numAmount.toLocaleString()}</strong> to <strong className="text-white">{selectedAccount?.name}</strong>. Please enter your password to confirm.
              </p>

              {modalError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleVerifyAndPost} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Your Password</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !confirmPassword}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Post"}
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