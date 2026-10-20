"use client";

import React, { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast, Toaster } from "react-hot-toast";
import ERPShell from "@/app/components/erp-shell";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  BookOpen,
  CheckCircle2,
  Wallet,
  MapPin,
  Phone,
  Mail,
  X,
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  taxNumber: string | null;
  openingBalance: string | number;
  status: string;
  createdAt: string;
};

export default function CustomersPage() {
  const { settings, formatAmount, currency } = useERPConfig();
  const isCompact = settings?.appearance?.dataDensity === "compact";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("ACTIVE");

  async function loadCustomers(value = search) {
    try {
      setLoading(true);
      const query = value.trim() ? `?search=${encodeURIComponent(value.trim())}` : "";
      const response = await fetch(`/api/customers${query}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load customers");
      setCustomers(data.customers || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(search);
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
    setShowForm(true);
  }

  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setName(customer.name);
    setEmail(customer.email || "");
    setPhone(customer.phone || "");
    setAddress(customer.address || "");
    setCity(customer.city || "");
    setTaxNumber(customer.taxNumber || "");
    setOpeningBalance(String(customer.openingBalance || "0"));
    setStatus(customer.status || "ACTIVE");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    resetForm();
  }

  async function deleteCustomer(id: string) {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      const res = await fetch("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "Customer deleted.");
        loadCustomers();
      } else {
        toast.error(data.error || "Failed to delete customer.");
      }
    } catch {
      toast.error("Error deleting customer");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Customer name is required.");
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

      const response = await fetch("/api/customers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save customer");

      toast.success(editingId ? "Customer updated!" : "Customer created!");
      setShowForm(false);
      resetForm();
      loadCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = customers.filter((c) => (c.status || "ACTIVE") === "ACTIVE").length;
  const totalOpeningReceivables = customers.reduce(
    (sum, c) => sum + Number(c.openingBalance || 0),
    0
  );
  const cellPad = isCompact ? "py-2.5 px-4" : "py-3.5 px-5";

  return (
    <>
      <Toaster position="top-right" />
      <ERPShell title="Customers Directory">
        <div className="space-y-6 relative z-10">
          {/* Header Bar */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                Sales &amp; Accounts Receivable
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                Customers Directory
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Manage customer profiles, contact information, opening balances, and receivable ledgers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => loadCustomers()}
                disabled={loading}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-500" : ""}`} />{" "}
                Refresh
              </button>

              <button
                type="button"
                data-shortcut="a"
                onClick={openCreate}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Total Customers
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {customers.length}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Registered client accounts
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Active Customers
                </span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {activeCount}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Enabled for invoicing
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  Opening Receivables Total
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
                  {currency} {formatAmount(totalOpeningReceivables)}
                </p>
                <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                  Initial brought-forward balances
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Customer Table Card */}
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 overflow-hidden">
            <div className="p-5 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Customer Directory
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Click &ldquo;Ledger&rdquo; on any customer to view their complete statement of account.
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email or phone..."
                  className="w-full bg-white dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-50/50 dark:bg-zinc-950/50">
                    <th className={cellPad}>Customer</th>
                    <th className={cellPad}>Contact</th>
                    <th className={cellPad}>Location</th>
                    <th className={`${cellPad} text-right`}>Opening Balance</th>
                    <th className={`${cellPad} text-center`}>Status</th>
                    <th className={`${cellPad} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-sm text-slate-400 dark:text-zinc-500 animate-pulse font-medium"
                      >
                        Loading customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                          No customers found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Click &ldquo;+ Add Customer&rdquo; above to register your first client.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const isActive = (c.status || "ACTIVE") === "ACTIVE";
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${
                            !isActive ? "opacity-60" : ""
                          }`}
                        >
                          <td className={cellPad}>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {c.name}
                            </div>
                            {c.address && (
                              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate max-w-[240px]">
                                {c.address}
                              </div>
                            )}
                          </td>

                          <td className={`${cellPad} text-xs text-slate-600 dark:text-zinc-300 space-y-0.5`}>
                            {c.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{c.phone}</span>
                              </div>
                            ) : (
                              <div>—</div>
                            )}
                            {c.email && (
                              <div className="flex items-center gap-1.5 text-slate-400 dark:text-zinc-500">
                                <Mail className="w-3 h-3" />
                                <span>{c.email}</span>
                              </div>
                            )}
                          </td>

                          <td className={`${cellPad} text-xs text-slate-600 dark:text-zinc-300`}>
                            {c.city ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" /> {c.city}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>

                          <td className={`${cellPad} text-right font-bold text-slate-900 dark:text-white whitespace-nowrap`}>
                            {currency} {formatAmount(Number(c.openingBalance || 0))}
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
                              {c.status || "ACTIVE"}
                            </span>
                          </td>

                          <td className={`${cellPad} text-right whitespace-nowrap`}>
                            <div className="inline-flex items-center justify-end gap-2">
                              <Link
                                href={`/sales/customers/ledger/${c.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-600 hover:text-white text-xs font-bold transition-all shadow-sm"
                              >
                                <BookOpen className="w-3.5 h-3.5" /> Ledger
                              </Link>
                              <button
                                type="button"
                                onClick={() => openEdit(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 text-xs font-semibold transition-all"
                                title="Edit Customer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCustomer(c.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all"
                                title="Delete Customer"
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

        {/* ADD / EDIT CUSTOMER MODAL */}
        {showForm && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeForm();
            }}
          >
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingId ? "Edit Customer" : "Add New Customer"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Enter customer contact details and opening receivable balance.
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
                      Customer Name *
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter customer name"
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
                      placeholder="customer@example.com"
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
                      placeholder="City"
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
                      placeholder="Tax number"
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
                      value={editingId ? "Locked" : openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      disabled={!!editingId}
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
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      disabled={!!editingId}
                      className="w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 disabled:opacity-60"
                    />
                  </div>

                  {editingId && (
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Customer Status
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
                      placeholder="Customer address"
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
                    {saving ? "Saving..." : editingId ? "Save Changes" : "Save Customer"}
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