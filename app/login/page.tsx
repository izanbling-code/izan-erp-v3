"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials.");
      }
    } catch (err) {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4 font-sans selection:bg-blue-500/30">
      <div className="max-w-sm w-full bg-[#131C2F] border border-slate-800/60 rounded-xl shadow-2xl p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg mb-3">
            <span className="text-lg font-black text-white tracking-wider">IB</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-wide">Izan Bling ERP</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0B1121] text-white border border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition-all placeholder-slate-700"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0B1121] text-white border border-slate-700 rounded p-2 text-sm focus:border-blue-500 outline-none transition-all placeholder-slate-700"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-2 rounded text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 rounded text-xs transition-all mt-2 uppercase tracking-wider"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Bulletproof fix for Chrome autofill white background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            transition: background-color 5000s ease-in-out 0s !important;
            -webkit-text-fill-color: #ffffff !important;
        }
      `}} />
    </div>
  );
}
