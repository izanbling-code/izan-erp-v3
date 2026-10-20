"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  BookOpen,
  CheckCircle2,
  Users,
  Wallet,
  MapPin,
  Phone,
  Mail,
  X,
} from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  taxNumber: string | null;
  openingBalance: string | number;
  creditLimit: string | number;
  status: string;
  createdAt: string;
};

export default function SuppliersPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("ACTIVE");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  async function loadSuppliers(value = search) {
    try {
      setLoading(true);
      setError("");

      const query = value.trim()
        ? `?search=${encodeURIComponent(value.trim())}`
        : "";

      const response = await fetch(`/api/suppliers${query}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load suppliers");
      }

      setSuppliers(data.suppliers || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load suppliers";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers(search);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setCity("");
    setTaxNumber("");
    setOpeningBalance("");
    setAsOfDate(new Date().toISOString().slice(0, 10));
    setStatus("ACTIVE");
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setError("");
    setShowForm(true);
  }

  function openEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setName(supplier.name);
    setEmail(supplier.email || "");
    setPhone(supplier.phone || "");
    setAddress(supplier.address || "");
    setCity(supplier.city || "");
    setTaxNumber(supplier.taxNumber || "");
    setOpeningBalance(String(supplier.openingBalance || "0"));
    setStatus(supplier.status || "ACTIVE");
    setError("");
    setShowForm(true);
  }

  async function deleteSupplier(id: string) {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const res = await fetch("/api/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "Supplier deleted.");
        loadSuppliers();
      } else {
        toast.error(data.error || "Failed to delete supplier.");
      }
    } catch {
      toast.error("Error deleting supplier.");
    }
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    resetForm();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        taxNumber: taxNumber.trim(),
      };

      if (editingId) {
        payload.id = editingId;
        payload.status = status;
      } else {
        payload.openingBalance = Number(openingBalance) || 0;
        payload.asOfDate = asOfDate;
      }

      const response = await fetch("/api/suppliers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save supplier");
      }

      toast.success(
        editingId ? "Supplier updated successfully!" : "Supplier created successfully!"
      );
      setShowForm(false);
      resetForm();
      await loadSuppliers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save supplier";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const activeCount = suppliers.filter(
    (supplier) => (supplier.status || "ACTIVE") === "ACTIVE"
  ).length;

  const totalOpeningBalances = suppliers.reduce(
    (sum, s) => sum + Number(s.openingBalance || 0),
    0
  );

  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Suppliers Directory">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Procurement &amp; Vendor Relations
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Suppliers Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage suppliers, contact details, tax registrations, and vendor ledger statements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => loadSuppliers()}
                disabled={loading}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} />{" "}
                Refresh
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Supplier
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Total Suppliers
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {suppliers.length}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Registered vendors
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Active Suppliers
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {activeCount}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Enabled for purchase billing
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Opening Balances Total
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                  {currency} {formatAmount(totalOpeningBalances)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Initial brought-forward payables
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Table Card */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Vendor Master List
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Click &ldquo;Ledger&rdquo; on any supplier to inspect their full statement of account.
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email or phone..."
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mx-5 mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold">
                {error}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Supplier</th>
                    <th className={cellPad}>Contact</th>
                    <th className={cellPad}>Location</th>
                    <th className={cellPad}>Tax Number / NTN</th>
                    <th className={`${cellPad} text-right`}>Opening Balance</th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium"
                      >
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No suppliers found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ Add Supplier&rdquo; above to register your first vendor.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => {
                      const isActive = (supplier.status || "ACTIVE") === "ACTIVE";
                      return (
                        <tr
                          key={supplier.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                            !isActive ? "opacity-60" : ""
                          }`}
                        >
                          <td className={cellPad}>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {supplier.name}
                            </div>
                            {supplier.address && (
                              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate max-w-[240px]">
                                {supplier.address}
                              </div>
                            )}
                          </td>

                          <td className={`${cellPad} text-xs text-slate-600 dark:text-zinc-300 space-y-0.5`}>
                            {supplier.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{supplier.phone}</span>
                              </div>
                            ) : (
                              <div>—</div>
                            )}
                            {supplier.email && (
                              <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500">
                                <Mail className="w-3 h-3" />
                                <span>{supplier.email}</span>
                              </div>
                            )}
                          </td>

                          <td className={`${cellPad} text-xs text-slate-600 dark:text-zinc-300`}>
                            {supplier.city ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" /> {supplier.city}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className={`${cellPad} font-mono text-xs text-slate-600 dark:text-zinc-400`}>
                            {supplier.taxNumber || "—"}
                          </td>

                          <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {currency} {formatAmount(Number(supplier.openingBalance || 0))}
                          </td>

                          <td className={`${cellPad} text-center whitespace-nowrap`}>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isActive
                                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"
                                  : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isActive ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              {supplier.status || "ACTIVE"}
                            </span>
                          </td>

                          <td className={`${cellPad} text-right whitespace-nowrap`}>
                            <div className="inline-flex items-center justify-end gap-2">
                              <Link
                                href={`/purchases/suppliers/ledger/${supplier.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-600 hover:text-white text-xs font-bold transition-all shadow-sm"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> Ledger
                              </Link>
                              <button
                                type="button"
                                onClick={() => openEdit(supplier)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                                title="Edit Supplier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSupplier(supplier.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all"
                                title="Delete Supplier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ADD / EDIT SUPPLIER MODAL */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeForm();
            }}
          >
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Supplier" : "Add New Supplier"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Enter vendor contact information and initial payable settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Supplier Name *
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter supplier name"
                      required
                      autoFocus
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="supplier@example.com"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Phone
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="03xx-xxxxxxx"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      City
                    </label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Rawalpindi / Lahore"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Tax Number / NTN
                    </label>
                    <input
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="Tax ID"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase block mb-1.5">
                      Opening Balance ({currency})
                    </label>
                    <input
                      type={editingId ? "text" : "number"}
                      min="0"
                      step="0.01"
                      disabled={!!editingId}
                      value={editingId ? "Locked" : openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-teal-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      As of Date
                    </label>
                    <input
                      type="date"
                      disabled={!!editingId}
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-60"
                    />
                  </div>

                  {editingId && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Supplier Status
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                      Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Full street address..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 resize-y"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editingId ? "Save Changes" : "Save Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ERPShell>
    </>
  );
}