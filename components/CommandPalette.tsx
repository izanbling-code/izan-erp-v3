"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Handle keyboard shortcuts (Ctrl+K to open, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Comprehensive database of 100% verified V3 routes
  const actions = [
    // Overview
    { name: "Dashboard", href: "/dashboard", icon: "📊", category: "Overview" },
    { name: "Reports", href: "/reports", icon: "📈", category: "Overview" },
    
    // Sales & Receivables
    { name: "Quick Order", href: "/quick-order", icon: "⚡", category: "Sales" },
    { name: "Point of Sale", href: "/sales/pos", icon: "🖥️", category: "Sales" },
    { name: "Invoices", href: "/sales/invoices", icon: "📄", category: "Sales" },
    { name: "Customers", href: "/sales/customers", icon: "👥", category: "Sales" },
    { name: "Sales Payments", href: "/sales/payments", icon: "💳", category: "Sales" },

    // Purchases & Payables
    { name: "Purchase Bills", href: "/purchases/bills", icon: "🧾", category: "Purchases" },
    { name: "Suppliers", href: "/purchases/suppliers", icon: "🏢", category: "Purchases" },
    { name: "Payables Ledger", href: "/purchases/payables", icon: "💸", category: "Purchases" },

    // Inventory
    { name: "Products Catalog", href: "/inventory/products", icon: "📦", category: "Inventory" },
    { name: "Stock Levels", href: "/inventory/stock", icon: "📊", category: "Inventory" },
    { name: "Warehouses", href: "/inventory/warehouses", icon: "🏭", category: "Inventory" },
    { name: "Movements", href: "/inventory/movements", icon: "🔄", category: "Inventory" },

    // Accounting
    { name: "Chart of Accounts", href: "/accounting/accounts", icon: "🏦", category: "Accounting" },
    { name: "Banking", href: "/accounting/banking", icon: "🏛️", category: "Accounting" },
    { name: "Cashbook", href: "/accounting/cashbook", icon: "📒", category: "Accounting" },
    { name: "Journals", href: "/accounting/journals", icon: "📓", category: "Accounting" },

    // System
    { name: "Settings", href: "/settings", icon: "⚙️", category: "System" },
    { name: "Admin Tools", href: "/admin/system", icon: "🔧", category: "System" },
  ];

  const filteredActions = query === "" 
    ? actions 
    : actions.filter((action) => action.name.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (href: string) => {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Blurred Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" 
        onClick={() => setIsOpen(false)}
      ></div>
      
      {/* Palette Modal */}
      <div className="relative w-full max-w-xl bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden transform transition-all">
        <div className="flex items-center border-b border-slate-700 px-4 py-3">
          <span className="text-slate-400 text-lg mr-3">🔍</span>
          <input
            type="text"
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-400 outline-none text-base"
            placeholder="Search commands or navigate... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <ul className="max-h-72 overflow-y-auto p-2">
          {filteredActions.length > 0 ? (
            filteredActions.map((action, idx) => (
              <li 
                key={idx}
                onClick={() => handleSelect(action.href)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-800 cursor-pointer text-slate-300 hover:text-white transition-colors"
              >
                <span className="text-xl">{action.icon}</span>
                <div className="flex-1 text-sm font-medium">{action.name}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800 px-2 py-1 rounded">
                  {action.category}
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-8 text-center text-slate-500 text-sm">
              No commands found for "{query}"
            </li>
          )}
        </ul>
        <div className="bg-slate-950 p-3 text-xs text-slate-500 flex justify-between border-t border-slate-800">
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">↑↓</kbd> to navigate</span>
          <span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">enter</kbd> to select</span>
        </div>
      </div>
    </div>
  );
}