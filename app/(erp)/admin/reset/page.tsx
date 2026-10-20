"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { 
  ShieldAlert, Key, Trash2, Calendar, Loader2, 
  CheckCircle2, AlertCircle, Lock 
} from "lucide-react";

export default function ResetDataPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password State
  const [configured, setConfigured] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Reset State
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [resetting, setResetting] = useState(false);
  const [clearedSummary, setClearedSummary] = useState<Record<string, number> | null>(null);

  // 1. Verify Admin Authentication from Cookie
  useEffect(() => {
    async function checkAuth() {
      try {
        const cookie = document.cookie.split("; ").find(row => row.startsWith("ib_session="));
        if (!cookie) throw new Error("No session found");
        
        const base64 = cookie.split("=")[1];
        const json = atob(base64);
        const payload = JSON.parse(json);
        
        // Allow if admin or has wildcard permissions
        const isAdmin = payload.email === "admin@izan.com" || (payload.permissions && payload.permissions.includes("/"));
        
        if (!isAdmin) {
          setIsAuthorized(false);
          setLoading(false);
          return;
        }
        
        setIsAuthorized(true);
        
        // Load Settings
        const { data: company } = await supabase.from("Company").select("id").limit(1).single();
        if (!company) throw new Error("Company not found");
        setCompanyId(company.id);

        const { data: settings } = await supabase
          .from("CompanySettings")
          .select("security")
          .eq("companyId", company.id)
          .single();

        if (settings?.security?.resetPassword) {
          setConfigured(true);
        }
      } catch (err) {
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Save/Change Password
  const handleSavePassword = async () => {
    setError(""); setSuccess("");
    if (newPassword.length < 4) return setError("Password must be at least 4 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    
    setSavingPassword(true);
    try {
      const { data: currentSettings } = await supabase.from("CompanySettings").select("security").eq("companyId", companyId).single();
      const securityData = currentSettings?.security || {};
      
      if (configured) {
        if (currentPassword !== securityData.resetPassword) {
          throw new Error("Incorrect current password.");
        }
      }

      const { error: updateErr } = await supabase
        .from("CompanySettings")
        .update({ security: { ...securityData, resetPassword: newPassword } })
        .eq("companyId", companyId);

      if (updateErr) throw updateErr;

      setSuccess(configured ? "Reset password updated." : "Reset password set.");
      setConfigured(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  // 3. Reset Data directly via Supabase
  const handleReset = async () => {
    setError(""); setSuccess(""); setClearedSummary(null);
    if (confirmText !== "RESET") return setError('Type RESET in the confirmation box.');
    
    setResetting(true);
    try {
      // Verify password first
      const { data: settings } = await supabase.from("CompanySettings").select("security").eq("companyId", companyId).single();
      if (resetPassword !== settings?.security?.resetPassword) {
        throw new Error("Invalid reset password.");
      }

      // Helper to delete rows
      const clearTable = async (table: string, dateField: string = "createdAt") => {
        let query = supabase.from(table).delete().eq("companyId", companyId);
        if (startDate) query = query.gte(dateField, startDate);
        if (endDate) query = query.lte(dateField, endDate);
        
        const { error, count } = await query.select("*", { count: 'exact' });
        if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
        return count || 0;
      };

      const summary: Record<string, number> = {};

      // Order matters for Foreign Keys (Children first)
      summary["Sales Payments"] = await clearTable("SalesPaymentAllocation");
      summary["Purchase Payments"] = await clearTable("PurchasePaymentAllocation");
      summary["Sales Lines"] = await clearTable("SalesInvoiceLine");
      summary["Purchase Lines"] = await clearTable("PurchaseBillLine");
      summary["Journal Lines"] = await clearTable("JournalLine");
      summary["Inventory Movements"] = await clearTable("InventoryMovement", "movementDate");
      summary["Order Lines"] = await clearTable("OrderLine");
      summary["Courier Payments"] = await clearTable("CourierPayment", "date");
      
      // Parent Tables
      summary["Sales Invoices"] = await clearTable("SalesInvoice", "invoiceDate");
      summary["Purchase Bills"] = await clearTable("PurchaseBill", "billDate");
      summary["Journal Entries"] = await clearTable("JournalEntry", "entryDate");
      summary["Orders"] = await clearTable("Order");
      summary["Payments"] = await clearTable("Payment", "paymentDate");
      
      // Optional: Reset Stock to 0 instead of deleting
      await supabase.from("Stock").update({ quantity: 0, averageCost: 0 }).eq("companyId", companyId);

      setClearedSummary(summary);
      setSuccess("Data reset successfully.");
      setShowResetForm(false);
      setResetPassword(""); setConfirmText("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="p-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-2" />
        <h1 className="text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-zinc-400 max-w-md">You do not have administrator permissions to access the system reset module.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-500" /> Reset System Data
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Wipe sales, purchases, and journal entries. Products, customers, and settings are kept.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" /> <p className="text-sm font-semibold">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> <p className="text-sm font-semibold">{success}</p>
        </div>
      )}

      {clearedSummary && (
        <div className="bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl border border-white/5">
          <h2 className="text-sm font-bold text-white mb-4">Rows Cleared</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(clearedSummary).map(([table, count]) => (
              <div key={table} className="flex justify-between border-b border-white/5 pb-2 text-sm">
                <span className="text-zinc-400">{table}</span>
                <strong className="text-white font-mono">{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Password Section */}
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-black/20">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-teal-500" /> {configured ? "Change Reset Password" : "Set Reset Password"}
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {configured ? "You must enter this password to authorize a data reset." : "Set a secure password before wiping data."}
          </p>
        </div>
        
        <div className="p-6 space-y-4">
          {configured && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 4 chars" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
          </div>
          <button onClick={handleSavePassword} disabled={savingPassword} className="bg-teal-500 hover:bg-teal-400 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-teal-500/20 disabled:opacity-50">
            {savingPassword ? "Saving..." : configured ? "Update Password" : "Set Password"}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-rose-500/30 overflow-hidden">
        <div className="p-6 border-b border-rose-500/20 bg-rose-500/5">
          <h2 className="text-lg font-bold text-rose-400 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Danger Zone
          </h2>
          <p className="text-sm text-rose-400/80 mt-1">
            This will permanently delete transactional records. You can optionally filter by date range.
          </p>
        </div>
        
        <div className="p-6">
          {!configured ? (
            <p className="text-sm text-zinc-500">Set a reset password above first.</p>
          ) : !showResetForm ? (
            <button onClick={() => setShowResetForm(true)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-rose-500/20">
              Initiate Data Reset
            </button>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">From Date (Optional)</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-rose-500 outline-none [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">To Date (Optional)</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-rose-500 outline-none [color-scheme:dark]" />
                </div>
              </div>
              <p className="text-xs text-zinc-500">Leave dates blank to wipe ALL data.</p>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Reset Password</label>
                <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-rose-500 outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Type "RESET" to confirm</label>
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESET" className="w-full bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-rose-500 outline-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleReset} disabled={resetting || confirmText !== "RESET"} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-2">
                  {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Data Reset"}
                </button>
                <button onClick={() => { setShowResetForm(false); setResetPassword(""); setConfirmText(""); }} className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2.5 rounded-lg font-bold text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}