"use client";
import { Suspense } from "react";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function UnauthorizedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetPath = searchParams.get("target") || "/dashboard";

  const [showOverride, setShowOverride] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, targetPath }),
    });

    if (res.ok) {
      // Success! The cookie is updated. Route them to the page they wanted.
      router.push(targetPath);
      router.refresh(); 
    } else {
      const data = await res.json();
      setError(data.error || "Override failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-center">
        <div className="bg-red-50 p-6 border-b border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🔒
          </div>
          <h1 className="text-2xl font-black text-slate-900">Access Denied</h1>
          <p className="text-slate-500 mt-2 text-sm">
            You do not have permission to view <span className="font-mono text-slate-700 font-bold bg-slate-100 px-1 py-0.5 rounded">{targetPath}</span>.
          </p>
        </div>

        <div className="p-6">
          <button 
            onClick={() => router.push("/dashboard")}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors mb-4"
          >
            Return to Dashboard
          </button>

          {!showOverride ? (
            <button 
              onClick={() => setShowOverride(true)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <span>🔑</span> Admin Override
            </button>
          ) : (
            <form onSubmit={handleOverride} className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Admin Authorization Required</p>
              <input
                type="password"
                placeholder="Enter Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-2 text-center tracking-widest"
              />
              {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded-lg transition-colors"
              >
                {loading ? "Verifying..." : "Grant Temporary Access"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <UnauthorizedContent />
    </Suspense>
  );
}
