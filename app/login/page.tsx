"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2,
  Store, TrendingUp, Box, AlertCircle
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      
      const result = await response.json();

      if (!response.ok || result.success !== true) {
        // The API returns specific messages for 403 (Pending) and 429 (Rate Limit)
        setError(result.error || "Unable to log in. Please check your credentials and try again.");
        return;
      }

      // Success: Push to dashboard AND refresh so the middleware picks up the cookie
      router.push("/dashboard");
      router.refresh();
      
    } catch {
      setError("Unable to connect to the login service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-950 font-sans">

      {/* =========================================
          LEFT SIDE: BRANDING & INFORMATION
          ========================================= */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 bg-zinc-900 border-r border-white/5 overflow-hidden">
        {/* Decorative Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-teal-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-lg font-black text-white tracking-tighter">IB</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Izan Bling ERP</span>
        </div>

        {/* Middle: Value Proposition */}
        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-4 leading-tight">
            Run your entire retail empire from one place.
          </h1>
          <p className="text-zinc-400 text-lg mb-10 leading-relaxed">
            The complete operating system for modern brands. Manage inventory, accounting, and your digital storefront seamlessly.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <Store className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Visual Storefront Builder</h3>
                <p className="text-sm text-zinc-500 mt-1">Design your shop without writing a single line of code.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <Box className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Real-time Inventory</h3>
                <p className="text-sm text-zinc-500 mt-1">Multi-warehouse tracking with automated stock adjustments.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Financial Control</h3>
                <p className="text-sm text-zinc-500 mt-1">Integrated double-entry accounting and profit tracking.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Footer info */}
        <div className="relative z-10 text-sm text-zinc-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Enterprise-grade security & role-based access control.</span>
        </div>
      </div>

      {/* =========================================
          RIGHT SIDE: THE LOGIN FORM
          ========================================= */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/30 mb-4">
              <span className="text-2xl font-black text-white tracking-tighter">IB</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            <p className="text-sm text-zinc-400 mt-2">Sign in to your Izan Bling workspace.</p>
          </div>

          {/* Desktop Welcome Text */}
          <div className="hidden lg:block mb-10">
            <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="text-zinc-400 mt-2">Enter your credentials to access your dashboard.</p>
          </div>

          {/* PREMIUM ERROR ALERT */}
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm animate-in fade-in zoom-in-95">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="someone@gmail.com"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-teal-500 hover:text-teal-400 transition-colors font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-12 pr-12 py-3.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white rounded-xl py-3.5 text-sm font-bold shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-zinc-950 px-4 text-zinc-500 font-medium">New to Izan Bling?</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <Link
            href="/signup"
            className="w-full flex items-center justify-center py-3.5 rounded-xl border border-white/10 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
          >
            Create an Account
          </Link>

        </div>
      </div>
    </div>
  );
}