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
    <aside className="relative overflow-hidden flex flex-col h-screen bg-zinc-950/80 backdrop-blur-2xl border-r border-white/5" style={{ width: "260px" }}>
      <style>{`
        .bank-nav-item {
          display: flex; align-items: center; padding: 10px 16px; margin: 2px 12px;
          border-radius: 8px; color: #a1a1aa; font-size: 0.85rem; font-weight: 600;
          text-decoration: none; transition: all 0.2s ease; border-left: 3px solid transparent;
        }
        .bank-nav-item:hover { background-color: rgba(255, 255, 255, 0.05); color: #f4f4f5; }
        .bank-nav-item.active { 
          background-color: rgba(20, 184, 166, 0.15); 
          color: #5eead4; 
          border-left: 3px solid #2dd4bf; 
          box-shadow: inset 0 0 12px rgba(20, 184, 166, 0.05);
        }
        .bank-nav-item.keyboard-focus {
          outline: 2px solid #2dd4bf !important;
          outline-offset: -1px;
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: #ffffff;
        }
        .bank-nav-section {
          padding: 18px 16px 6px 20px; font-size: 0.65rem; text-transform: uppercase;
          letter-spacing: 0.08em; font-weight: 800; color: #52525b;
        }
        .erp-navigation::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Brand Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-6 border-b border-white/5 bg-zinc-950/30">
        <div style={{ background: "linear-gradient(135deg, #009b9b 0%, #004e54 100%)", color: "white", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: "16px", boxShadow: "0 4px 12px rgba(0,155,155,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
          IB
        </div>
        <div>
          <div style={{ color: "#ffffff", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1.1, textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>IZAN BLING</div>
          <div style={{ color: "#009b9b", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Corporate Ledger</div>
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
      <div className="shrink-0 mt-auto border-t border-white/5 p-4 bg-zinc-950/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>AD</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#f4f4f5", fontSize: "0.8rem", fontWeight: 700 }}>Administrator</div>
            <div style={{ color: "#52525b", fontSize: "0.65rem", fontWeight: 600 }}>Active Session</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
