"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { 
  UserPlus, CheckCircle2, XCircle, Search, ShieldAlert, 
  User as UserIcon, Loader2, Lock, Trash2, ShieldOff, X
} from "lucide-react";

type Role = { id: string; name: string; };
type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleId: string | null;
  role: Role | null;
  createdAt: string;
};

export default function UsersSettingsPage() {
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "PENDING">("ACTIVE");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Modal State
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });

  // Security Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // 1. Get Current User ID from Cookie
  useEffect(() => {
    try {
      const cookie = document.cookie.split("; ").find(row => row.startsWith("ib_session="));
      if (cookie) {
        const base64 = cookie.split("=")[1];
        const payload = JSON.parse(atob(base64));
        setCurrentUserId(payload.userId);
      }
    } catch (e) { console.error("Failed to read session"); }
  }, []);

  // 2. Load Data via Supabase
  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      if (!company) throw new Error("Company not found");

      const { data: userData, error: userErr } = await supabase
        .from("User")
        .select(`id, name, email, isActive, roleId, createdAt, role:Role(id, name)`)
        .eq("companyId", company.id)
        .order("name");

      if (userErr) throw userErr;
      
      console.log("Loaded users from Supabase:", userData); // Debugging helper
      setUsers(userData || []);

      const { data: roleData } = await supabase
        .from("Role")
        .select("id, name")
        .eq("companyId", company.id)
        .order("name");
      
      setRoles(roleData || []);

    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const activeUsers = users.filter(u => u.isActive);
  const pendingUsers = users.filter(u => !u.isActive);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    return activeUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [activeUsers, search]);

  // 3. Save User Trigger
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!form.name.trim() || !form.email.trim()) return setError("Name and Email are required.");
    if (!editingUser && form.password.length < 6) return setError("Password must be at least 6 characters.");

    if (editingUser) {
      // Prompt for admin password before editing
      setConfirmPassword("");
      setPasswordError("");
      setShowPasswordModal(true);
    } else {
      // Create new user directly
      await executeSave();
    }
  }

  // 4. Verify Admin Password
  async function verifyPasswordAndSave() {
    setPasswordError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: confirmPassword })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect password");

      await executeSave(); // Password verified, proceed to save
      setShowPasswordModal(false);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  // 5. Execute Save (Calls the Secure Server API)
  async function executeSave() {
    try {
      setSaving(true);
      
      // ✅ SECURITY FIX: Use the API route to hash password properly
      const res = await fetch("/api/admin/users/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser?.id,
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          roleId: form.roleId || null,
          isActive: editingUser ? editingUser.isActive : true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save user");

      setSuccess(editingUser ? "User updated successfully." : "User created successfully.");
      setShowForm(false);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  // 6. Actions (Revoke, Delete, Approve)
  async function toggleStatus(user: User) {
    if (user.id === currentUserId) return alert("You cannot revoke your own access.");
    try {
      const { error } = await supabase.from("User").update({ isActive: !user.isActive }).eq("id", user.id);
      if (error) throw error;
      setSuccess(`User ${user.isActive ? "revoked" : "approved"}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deleteUser(user: User) {
    if (user.id === currentUserId) return alert("You cannot delete yourself.");
    if (!window.confirm(`Permanently delete ${user.name}?`)) return;
    
    try {
      setDeletingId(user.id);
      const { error } = await supabase.from("User").delete().eq("id", user.id);
      
      if (error) {
        if (error.code === '23503') { // Foreign Key violation
          alert("Cannot delete: This user has transactions linked to them. Please Revoke access instead.");
        } else {
          throw error;
        }
      } else {
        setSuccess("User deleted.");
        await loadData();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="p-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-teal-500" /> User Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Manage system access and approve new signups.</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setForm({ name: "", email: "", password: "", roleId: "" }); setShowForm(true); }}
          className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-teal-500/20"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">{error}</div>}
      {success && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button onClick={() => setActiveTab("ACTIVE")} className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "ACTIVE" ? "border-teal-500 text-teal-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
          Active Users ({activeUsers.length})
        </button>
        <button onClick={() => setActiveTab("PENDING")} className={`px-4 py-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${activeTab === "PENDING" ? "border-amber-500 text-amber-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
          Pending Approvals {pendingUsers.length > 0 && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
        </button>
      </div>

      {/* CREATE / EDIT FORM */}
      {showForm && (
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">{editingUser ? "Edit User" : "Create New User"}</h2>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">{editingUser ? "New Password (Optional)" : "Password"}</label>
              <input required={!editingUser} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder={editingUser ? "Leave blank to keep current" : "••••••••"} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Assign Role</label>
              <select value={form.roleId} onChange={(e) => setForm({...form, roleId: e.target.value})} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none">
                <option value="">No role assigned</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/5">
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="bg-teal-500 hover:bg-teal-400 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50">
                {saving ? "Saving..." : editingUser ? "Save & Verify Password" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 1: ACTIVE USERS */}
      {activeTab === "ACTIVE" && (
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
            </div>
          </div>
          
          <table className="w-full text-left">
            <thead className="bg-zinc-950/50 border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold text-white">{user.name}</div>
                        <div className="text-xs text-zinc-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{user.role?.name || "No Role"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {user.isActive ? "ACTIVE" : "REVOKED"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditingUser(user); setForm({ name: user.name, email: user.email, password: "", roleId: user.roleId || "" }); setShowForm(true); }} className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors">Edit</button>
                      <button onClick={() => toggleStatus(user)} disabled={user.id === currentUserId} className="px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 rounded-lg text-amber-400 transition-colors disabled:opacity-50" title="Revoke Access"><ShieldOff className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteUser(user)} disabled={user.id === currentUserId} className="px-3 py-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors disabled:opacity-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-zinc-500">No active users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: PENDING APPROVALS */}
      {activeTab === "PENDING" && (
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-amber-500/5">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> These users have verified their email but cannot log in until approved.
            </h3>
          </div>
          
          <table className="w-full text-left">
            <thead className="bg-zinc-950/50 border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Requested On</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pendingUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{user.name}</div>
                    <div className="text-xs text-zinc-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">
                    {new Date(user.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => toggleStatus(user)} className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => deleteUser(user)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingUsers.length === 0 && (
                <tr><td colSpan={3} className="text-center py-12 text-zinc-500"><CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-500/50" />No pending requests. You're all caught up!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SECURITY PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Security Check</h2>
              <p className="text-sm text-zinc-400 mb-6">Enter your admin password to confirm changes to <strong>{editingUser?.name}</strong>.</p>

              {passwordError && <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-semibold">{passwordError}</div>}

              <input
                type="password"
                autoFocus
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 mb-4 text-center"
                onKeyDown={(e) => e.key === 'Enter' && verifyPasswordAndSave()}
              />

              <div className="flex gap-3">
                <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5">Cancel</button>
                <button onClick={verifyPasswordAndSave} disabled={verifying || !confirmPassword} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}