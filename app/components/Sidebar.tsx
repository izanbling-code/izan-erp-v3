"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { section: "Overview", items: [ { label: "Dashboard", href: "/", icon: "⊞" } ] },
  { section: "Receivables", items: [ { label: "Invoices", href: "/sales/invoices", icon: "📄" }, { label: "Customers", href: "/sales/customers", icon: "👥" }, { label: "Incoming Funds", href: "/sales/payments", icon: "📥" } ] },
  { section: "Payables", items: [ { label: "Purchase Bills", href: "/purchases/bills", icon: "🧾" }, { label: "Suppliers", href: "/purchases/suppliers", icon: "🏢" }, { label: "Disbursements", href: "/purchases/payables", icon: "📤" } ] },
  { section: "Treasury", items: [ { label: "Bank Directory", href: "/accounting/banking", icon: "🏦" }, { label: "Cash Book", href: "/accounting/cashbook", icon: "💵" }, { label: "Chart of Accounts", href: "/accounting/accounts", icon: "📊" }, { label: "Journal Entries", href: "/accounting/journals", icon: "⚖️" } ] },
  { section: "Operations", items: [ { label: "Inventory Master", href: "/inventory/products", icon: "📦" }, { label: "Stock Ledger", href: "/inventory/stock", icon: "📋" }, { label: "Warehouses", href: "/inventory/warehouses", icon: "🏭" } ] },
  { section: "Intelligence", items: [ { label: "Financial Reports", href: "/reports", icon: "📈" }, { label: "Month-End Close", href: "/accounting/closings", icon: "🔒" } ] },
  { section: "Administration", items: [ { label: "System Settings", href: "/settings", icon: "⚙️" }, { label: "User Access", href: "/settings/users", icon: "🛡️" } ] },
];

const flatLinks = navigation.flatMap(g => g.items);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const initialIndex = flatLinks.findIndex(item => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);

  useEffect(() => {
    const currentIndex = flatLinks.findIndex(item => item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (currentIndex >= 0) setSelectedIndex(currentIndex);
  }, [pathname]);

  useEffect(() => {
    const activeElement = document.getElementById(`sidebar-link-${selectedIndex}`);
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      // Surrender standard arrows to the data grid if one is on screen (Hold Ctrl to force sidebar)
      if (document.querySelector('.erp-data-table') && !e.ctrlKey) return;
      if (e.altKey || e.ctrlKey) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < flatLinks.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        router.push(flatLinks[selectedIndex].href);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, router]);

  let globalItemIndex = 0;

  return (
    <aside className="relative overflow-hidden flex flex-col h-screen" style={{ backgroundColor: "#0b1120", borderRight: "1px solid #1e293b", width: "260px" }}>
      <style>{`
        .bank-nav-item {
          display: flex; align-items: center; padding: 10px 16px; margin: 2px 12px;
          border-radius: 6px; color: #94a3b8; font-size: 0.85rem; font-weight: 600;
          text-decoration: none; transition: all 0.15s ease; border-left: 3px solid transparent;
        }
        .bank-nav-item:hover { background-color: #1e293b; color: #f8fafc; }
        .bank-nav-item.active { background-color: #1e293b; color: #38bdf8; border-left: 3px solid #38bdf8; }
        .bank-nav-item.keyboard-focus {
          outline: 2px solid #38bdf8 !important;
          outline-offset: -1px;
          background-color: #1e293b !important;
          color: #ffffff;
        }
        .bank-nav-section {
          padding: 18px 16px 6px 20px; font-size: 0.65rem; text-transform: uppercase;
          letter-spacing: 0.08em; font-weight: 800; color: #475569;
        }
        .erp-navigation::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Brand Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-6 border-b border-slate-800">
        <div style={{ background: "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)", color: "white", width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "16px", boxShadow: "0 4px 10px rgba(37,99,235,0.3)" }}>
          IB
        </div>
        <div>
          <div style={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}>IZAN BLING</div>
          <div style={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Corporate Ledger</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="erp-navigation pb-20 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {navigation.map((group, index) => (
          <div key={group?.section || index}>
            <div className="bank-nav-section">{group?.section}</div>
            {group?.items?.map((item) => {
              const currentGlobalIndex = globalItemIndex++;
              const isMouseActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const isKeyboardFocused = currentGlobalIndex === selectedIndex;

              return (
                <Link
                  key={item.href}
                  id={`sidebar-link-${currentGlobalIndex}`}
                  href={item.href}
                  className={`bank-nav-item ${isMouseActive ? "active" : ""} ${isKeyboardFocused ? "keyboard-focus" : ""}`}
                >
                  <span style={{ marginRight: 12, fontSize: "1.1rem", opacity: isMouseActive ? 1 : 0.7 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 mt-auto border-t border-slate-800 p-4" style={{ backgroundColor: "#070c17" }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#1e293b", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>AD</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 700 }}>Administrator</div>
            <div style={{ color: "#475569", fontSize: "0.65rem", fontWeight: 600 }}>Active Session</div>
          </div>
        </div>
      </div>
    </aside>
  );
}