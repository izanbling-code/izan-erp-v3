"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/app/lib/supabase";
import { 
  ShieldCheck, Plus, Search, X, Loader2, Save, 
  Trash2, Edit, CheckSquare, Square, AlertCircle, Users
} from "lucide-react";

// Define all available modules grouped by category
const AVAILABLE_MODULES = [
  { group: "Overview", items: [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Events Planner", path: "/events" },
    { name: "Public Shop", path: "/shop" },
    { name: "Shop Admin", path: "/shop/admin" },
  ]},
  { group: "Sales", items: [
    { name: "Sales Invoices", path: "/sales" },
    { name: "Customers", path: "/sales/customers" },
    { name: "Sales Payments", path: "/sales/payments" },
    { name: "Couriers", path: "/couriers" },
    { name: "Orders", path: "/orders" },
  ]},
  { group: "Purchases", items: [
    { name: "Purchase Bills", path: "/purchases/bills" },
    { name: "Suppliers", path: "/purchases/suppliers" },
    { name: "Returns & Transfers", path: "/purchases/returns" },
    { name: "Payables Ledger", path: "/purchases/payables" },
  ]},
  { group: "Inventory", items: [
    { name: "Inventory Hub", path: "/inventory" },
    { name: "Products", path: "/inventory/products" },
    { name: "Stock Adjustments", path: "/inventory/stock" },
    { name: "Stock Movements", path: "/inventory/movements" },
  ]},
  { group: "Accounting", items: [
    { name: "Chart of Accounts", path: "/accounting/accounts" },
    { name: "Banking & Cashbook", path: "/accounting/banking" },
    { name: "Cashbook", path: "/accounting/cashbook" },
    { name: "Journal Entries", path: "/accounting/journals" },
    { name: "Opening Balances", path: "/accounting/opening-balances" },
    { name: "Loans & Repayments", path: "/accounting/loans" },
    { name: "Withdrawals", path: "/admin/withdrawals" },
  ]},
  { group: "Reports & Settings", items: [
    { name: "All Reports", path: "/reports" },
    { name: "System Settings", path: "/settings" },
    { name: "Company Profile", path: "/settings/company" },
    { name: "User Management", path: "/settings/users" },
    { name: "Role Management", path: "/settings/roles" },
    { name: "System Monitor", path: "/admin/system" },
    { name: "System Reset", path: "/admin/reset" },
  ]},
];

type Role = {
  id: string;
  name: string;
  permissions: string[];
  users: any[];
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", permissions: [] as string[] });
  const [saving, setSaving] = useState(false);

  async function loadRoles() {
    try {
      setLoading(true);
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      
      const { data, error } = await supabase
        .from("Role")
        .select(`*, users:User(id)`)
        .eq("companyId", company?.id)
        .order("name");

      if (error) throw error;
      setRoles(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRoles(); }, []);

  const filteredRoles = useMemo(() => {
    return roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [roles, search]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ name: "", permissions: [] });
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingId(role.id);
    setFormData({ name: role.name, permissions: role.permissions || [] });
    setShowModal(true);
  };

  const togglePermission = (path: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(path)
        ? prev.permissions.filter(p => p !== path)
        : [...prev.permissions, path]
    }));
  };

  const handleSelectAll = (group: string) => {
    const groupPaths = AVAILABLE_MODULES.find(m => m.group === group)?.items.map(i => i.path) || [];
    const allSelected = groupPaths.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      // Remove all in this group
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !groupPaths.includes(p))
      }));
    } else {
      // Add all in this group
      setFormData(prev => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...groupPaths]))
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert("Role name is required.");
    
    setSaving(true);
    try {
      const { data: company } = await supabase.from("Company").select("id").limit(1).single();
      const now = new Date().toISOString();

      if (editingId) {
        const { error: updateErr } = await supabase.from("Role").update({
          name: formData.name,
          permissions: formData.permissions,
          updatedAt: now
        }).eq("id", editingId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from("Role").insert({
          id: crypto.randomUUID(),
          companyId: company?.id,
          name: formData.name,
          permissions: formData.permissions,
          createdAt: now,
          updatedAt: now
        });
        if (insertErr) throw insertErr;
      }

      setShowModal(false);
      await loadRoles();
    } catch (err: any) {
      alert("Failed to save role: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this role? Users assigned to it will lose access.")) return;
    try {
      // Optional: Check if users are assigned
      const role = roles.find(r => r.id === id);
      if (role && role.users.length > 0) {
        return alert(`Cannot delete: ${role.users.length} users are currently assigned to this role.`);
      }
      
      const { error } = await supabase.from("Role").delete().eq("id", id);
      if (error) throw error;
      await loadRoles();
    } catch (err: any) {
      alert("Failed to delete role: " + err.message);
    }
  };

  if (loading) return <div className="p-20 flex justify-center text-teal-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-500" /> Role Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Configure module access and permissions for your team.</p>
        </div>
        <button onClick={openCreateModal} className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm transition-colors shadow-lg shadow-teal-500/20">
          <Plus className="w-4 h-4" /> Create Role
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" /> <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-zinc-900/60 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Search roles..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-950 border border-white/10 rounded-lg outline-none focus:border-teal-500 text-white" />
          </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-zinc-950/50 border-b border-white/5 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
            <tr>
              <th className="px-6 py-4">Role Name</th>
              <th className="px-6 py-4">Active Users</th>
              <th className="px-6 py-4 w-1/2">Granted Permissions</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRoles.map((role) => (
              <tr key={role.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-bold text-white">{role.name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Users className="w-4 h-4" /> {role.users?.length || 0} Users
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions?.includes("/") ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase">All Access</span>
                    ) : role.permissions?.length > 0 ? (
                      role.permissions.map(p => {
                        const mod = AVAILABLE_MODULES.flatMap(m => m.items).find(i => i.path === p);
                        return (
                          <span key={p} className="bg-zinc-800 text-zinc-300 border border-white/5 px-2 py-1 rounded text-[10px] font-medium">
                            {mod?.name || p}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-zinc-500 text-xs italic">No access</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEditModal(role)} className="p-1.5 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(role.id)} className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-md transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRoles.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-zinc-500">No roles found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20 shrink-0">
              <h2 className="text-xl font-bold text-white">{editingId ? "Edit Role" : "Create New Role"}</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Role Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Senior Accountant" className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-teal-500 outline-none" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Module Permissions</label>
                    <button type="button" onClick={() => setFormData({...formData, permissions: ["/"]})} className="text-xs text-teal-400 hover:text-teal-300 font-semibold">Grant All Access (Admin)</button>
                  </div>

                  {AVAILABLE_MODULES.map(group => {
                    const groupPaths = group.items.map(i => i.path);
                    const allSelected = groupPaths.every(p => formData.permissions.includes(p));
                    
                    return (
                      <div key={group.group} className="bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-sm font-bold text-white">{group.group}</h3>
                          <button type="button" onClick={() => handleSelectAll(group.group)} className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-teal-400 transition-colors">
                            {allSelected ? "Deselect All" : "Select All"}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {group.items.map(mod => {
                            const isChecked = formData.permissions.includes(mod.path) || formData.permissions.includes("/");
                            return (
                              <div 
                                key={mod.path} 
                                onClick={() => {
                                  if (formData.permissions.includes("/")) return; // Prevent unchecking if all access is on
                                  togglePermission(mod.path);
                                }}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-teal-500/10 border-teal-500/30' : 'bg-transparent border-white/5 hover:bg-white/5'} ${formData.permissions.includes("/") ? 'opacity-70 cursor-not-allowed' : ''}`}
                              >
                                {isChecked ? <CheckSquare className="w-4 h-4 text-teal-400 shrink-0" /> : <Square className="w-4 h-4 text-zinc-500 shrink-0" />}
                                <span className={`text-xs font-medium ${isChecked ? 'text-teal-100' : 'text-zinc-400'}`}>{mod.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-5 border-t border-white/5 bg-black/20 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg border border-white/10 text-sm font-semibold text-zinc-300 hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-lg bg-teal-500 text-sm font-bold text-white hover:bg-teal-400 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {editingId ? "Save Changes" : "Create Role"}</>}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}