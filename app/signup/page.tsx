"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { Mail, Lock, User, ShieldCheck, Loader2, AlertCircle } from "lucide-react";

export default function SignupPage() {
  const [step, setStep] = useState<"FORM" | "VERIFY">("FORM");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 1. Send Signup Request & OTP
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // ✅ 1. Strict Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address (e.g., name@domain.com).");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      // 2. Call Supabase Auth to send OTP
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      // Move to OTP verification step
      setStep("VERIFY");
    } catch (err: any) {
      setError(err.message || "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP Code & Save to Database
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Verify with Supabase
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "signup",
      });

      if (error) throw error;

      // ✅ 4. Save User to Prisma Database (Pending Approval)
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName, email, password }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to save account to database.");
      }

      // 5. Redirect to the Pending Approval page
      router.push("/pending-approval");
      
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-zinc-950 overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 bg-white/[0.03] border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl shadow-teal-500/10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 mb-6">
            <span className="text-2xl font-black text-white tracking-tighter">IB</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
            {step === "FORM" ? "Create an Account" : "Verify Your Email"}
          </h1>
          <p className="text-sm text-zinc-400">
            {step === "FORM"
              ? "Join Izan Bling to manage your enterprise."
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm animate-in fade-in zoom-in-95">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* --- SIGNUP FORM --- */}
        {step === "FORM" && (
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@izanbling.com" className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl py-3.5 text-sm font-bold shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-70">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
            </button>
          </form>
        )}

        {/* --- OTP VERIFICATION FORM --- */}
        {step === "VERIFY" && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">6-Digit Code</label>
              <input type="text" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" className="w-full text-center tracking-[0.5em] bg-black/40 border border-white/10 rounded-xl py-4 text-xl font-bold text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all" />
            </div>
            <button type="submit" disabled={loading} className="w-full mt-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl py-3.5 text-sm font-bold shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-70">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Submit Request"}
            </button>
            <button type="button" onClick={() => setStep("FORM")} className="w-full text-center text-xs text-zinc-500 hover:text-white transition-colors mt-2">
              Wrong email? Go back.
            </button>
          </form>
        )}

        {/* Divider & Sign In Link */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0c0c0e] px-4 text-zinc-500 font-medium rounded-full">Already have an account?</span>
          </div>
        </div>
        <Link href="/login" className="w-full flex items-center justify-center py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white hover:bg-white/5 transition-colors">
          Sign In
        </Link>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500/70" />
          <span>Protected by Enterprise RBAC & Audit Logging</span>
        </div>
      </div>
    </div>
  );
}