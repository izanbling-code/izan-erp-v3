"use client";

import { useState, useEffect } from "react";

const AVAILABLE_MODULES = [
  { name: "Dashboard & Reports", path: "/dashboard", group: "Overview" },
  { name: "Quick Order", path: "/quick-order", group: "Sales" },
  { name: "Point of Sale", path: "/sales/pos", group: "Sales" },
  { name: "Invoices & Customers", path: "/sales/invoices", group: "Sales" },
  { name: "Sales Payments", path: "/sales/payments", group: "Sales" },
  { name: "Purchase Bills & Suppliers", path: "/purchases/bills", group: "Purchases" },
  { name: "Payables Ledger", path: "/purchases/payables", group: "Purchases" },
  { name: "Inventory Management", path: "/inventory", group: "Inventory" },
  { name: "Accounting & Banking", path: "/accounting", group: "Accounting" },
  { name: "System Settings", path: "/settings", group: "System" },
];

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (data.success) setRoles(data.roles);
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (path: string) => {
    setSelectedPaths(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(""); // Reset error state on new attempt
    
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName, permissions: selectedPaths })
    });
    
    const data = await res.json();
    
    if (res.ok && data.success) {
      setNewRoleName("");
      setSelectedPaths([]);
      setIsCreating(false);
      fetchRoles();
    } else {
      // If it fails, print the exact reason to the screen
      setErrorMessage(data.error || "Database failed to save the role.");
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Role Management</h1>
          <p className="text-slate-500 mt-1">Configure access control and URL permissions.</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition-colors"
        >
          {isCreating ? "Cancel" : "+ Create Role"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateRole} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          
          {/* ERROR BANNER */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm font-bold flex items-center gap-2">
              <span>⚠️</span> {errorMessage}
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Role Name</label>
            <input 
              type="text" 
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., Junior Accountant"
              className="w-full max-w-md border border-slate-300 rounded-lg px-4 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <label className="block text-sm font-bold text-slate-700 mb-4">Module Permissions</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {AVAILABLE_MODULES.map((mod) => (
              <label key={mod.path} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input 
                  type="checkbox" 
                  checked={selectedPaths.includes(mod.path)}
                  onChange={() => togglePermission(mod.path)}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{mod.name}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">{mod.group}</div>
                </div>
              </label>
            ))}
          </div>
          
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium shadow-md transition-colors">
            Save Role & Permissions
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Role Name</th>
              <th className="px-6 py-4">Active Users</th>
              <th className="px-6 py-4">Granted Permissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-bold">{role.name}</td>
                <td className="px-6 py-4">{role._count?.users || 0} Users</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.includes("/") ? (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">ALL ACCESS</span>
                    ) : (
                      role.permissions.map((p: string) => (
                        <span key={p} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium border border-slate-200">
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}