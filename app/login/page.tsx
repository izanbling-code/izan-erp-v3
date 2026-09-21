"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("admin@izan.com");
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
        setError(data.error || "Unable to connect to the server.");
      }
    } catch (err) {
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4 font-sans selection:bg-blue-500/30">
      <div className="max-w-md w-full bg-[#131C2F] border border-slate-800/60 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 mb-4">
            <span className="text-2xl font-black text-white tracking-wider">IB</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Izan Bling ERP</h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0B1121] text-white border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none transition-all placeholder-slate-600"
              placeholder="admin@izan.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0B1121] text-white border border-slate-700 rounded-lg p-3 text-sm focus:border-blue-500 outline-none transition-all placeholder-slate-600"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-500/25 mt-2 uppercase tracking-wider"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-600 font-medium">Izan Bling ERP V3</p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Overrides Chrome's default white autofill background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #0B1121 inset !important;
            -webkit-text-fill-color: white !important;
        }
      `}} />
    </div>
  );
}
