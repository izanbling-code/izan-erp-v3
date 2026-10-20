"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Lock, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Get the user's email from the active session (created by the confirm route)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      setError("Could not verify user session. Please try the link again.");
      setLoading(false);
      return;
    }

    // 2. Update the password in Supabase
    const { error: supabaseError } = await supabase.auth.updateUser({ password });
    
    if (supabaseError) {
      setError(supabaseError.message);
      setLoading(false);
      return;
    }

    // 3. Update the password in your Prisma Database
    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    });

    if (!res.ok) {
      setError("Failed to update ERP password. Please contact support.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 3000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        {success ? (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Password Updated!</h1>
            <p className="text-zinc-400 text-sm">Your password has been securely changed. Redirecting to login...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
            <p className="text-sm text-zinc-400 mb-6">Enter a strong new password for your account.</p>

            {error && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg">{error}</div>}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 transition-all"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-teal-500 hover:bg-teal-400 text-white rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}