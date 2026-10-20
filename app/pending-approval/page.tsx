import Link from "next/link";
import { Clock, ArrowLeft } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Account Pending Approval</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Your email has been verified! However, an administrator must manually approve your account before you can access the workspace.
        </p>
        <Link href="/login" className="inline-flex items-center gap-2 text-teal-500 hover:text-teal-400 font-semibold text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Return to Login
        </Link>
      </div>
    </div>
  );
}