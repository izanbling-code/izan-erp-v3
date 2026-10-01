"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Settings2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  CreditCard,
  Truck,
  RefreshCw,
  Box,
  Store,
  FastForward,
  Landmark,
  BookOpen,
  Wallet,
  Calendar,
  BarChart3,
  ShieldCheck,
  Building2,
  UserCheck,
  Lock,
  Layers,
  Scale,
  Receipt,
  Warehouse,
  Sparkles,
  AlertTriangle,
  Activity,
  HandCoins,
  PlusCircle,
  MonitorSmartphone,
} from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function Sidebar() {
  const pathname = usePathname();
  const { config: generalConfig, loading } = useERPConfig("general");
  const { config: appearanceConfig, updateCategory } = useERPConfig("appearance");

  // Local state for instant UI response
  const [isCollapsed, setIsCollapsed] = useState(appearanceConfig?.sidebarMode === "collapsed");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Keep in sync if settings change from the Settings Page
  useEffect(() => {
    setIsCollapsed(appearanceConfig?.sidebarMode === "collapsed");
  }, [appearanceConfig?.sidebarMode]);

  // Toggle and save to global settings engine silently
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (appearanceConfig) {
      updateCategory("appearance", {
        ...appearanceConfig,
        sidebarMode: newState ? "collapsed" : "expanded",
      });
    }
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [label]: prev[label] === false ? true : false,
    }));
  };

  const menuGroups = [
    {
      label: "MAIN",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Orders", href: "/orders", icon: FastForward },
        { name: "Couriers", href: "/couriers", icon: Truck },
        { name: "Events Planner", href: "/events", icon: Calendar },
        { name: "Shop Admin", href: "/shop/admin", icon: Store },
        { name: "Public Shop", href: "/shop", icon: Sparkles },
      ],
    },
    {
      label: "SALES",
      items: [
        { name: "Sales Invoices", href: "/sales", icon: ShoppingCart },
        { name: "Customers", href: "/sales/customers", icon: Users },
        { name: "Sales Payments", href: "/sales/payments", icon: CreditCard },
      ],
    },
   {
      label: "PURCHASES",
      items: [
        { name: "Purchase Bills", href: "/purchases/bills", icon: ShoppingBag },
        { name: "Returns & Transfer Out", href: "/purchases/returns", icon: RefreshCw },
        { name: "Suppliers", href: "/purchases/suppliers", icon: Truck },
        { name: "Payables Ledger", href: "/purchases/payables", icon: FileText },
      ],
    },
    {
      label: "INVENTORY",
      items: [
        { name: "Inventory & Warehouses", href: "/inventory", icon: Package },
        { name: "Products", href: "/inventory/products", icon: Box },
        { name: "Stock Adjustments", href: "/inventory/stock", icon: Scale },
        { name: "Stock Movements", href: "/inventory/movements", icon: RefreshCw },
      ],
    },
    {
      label: "ACCOUNTING & BANK",
      items: [
        { name: "Chart of Accounts", href: "/accounting/accounts", icon: BookOpen },
        { name: "Bank Directory", href: "/accounting/banking", icon: Landmark },
        { name: "Cashbook", href: "/accounting/cashbook", icon: Wallet },
        { name: "Journal Entries", href: "/accounting/journals", icon: FileText },
        { name: "Loans & Repayments", href: "/accounting/loans", icon: HandCoins },
        { name: "Withdrawals", href: "/admin/withdrawals", icon: Wallet },
        { name: "Opening Balances", href: "/accounting/opening-balances", icon: Scale },
        { name: "Payments Center", href: "/payments", icon: Receipt },
      ],
    },
    {
      label: "REPORTS",
      items: [
        { name: "All Reports", href: "/reports", icon: BarChart3 },
      ],
    },
    {
      label: "SETTINGS & ADMIN",
      items: [
        { name: "System Settings", href: "/settings", icon: Settings2 },
        { name: "Company Profile", href: "/settings/company", icon: Building2 },
        { name: "Users", href: "/settings/users", icon: UserCheck },
        { name: "Roles & Permissions", href: "/settings/roles", icon: ShieldCheck },
        { name: "Fiscal Closings", href: "/admin/closings", icon: Lock },
        { name: "System Monitor", href: "/admin/system", icon: Activity },
        { name: "System Reset", href: "/admin/reset", icon: AlertTriangle },
      ],
    },
  ];

  // Exact or deepest-prefix active route matching so parent routes don't stay highlighted on sub-routes
  const allHrefs = menuGroups.flatMap((g) => g.items.map((i) => i.href));
  const isItemActive = (href: string) => {
    if (pathname === href) return true;
    if (pathname?.startsWith(href + "/")) {
      const hasMoreSpecificMatch = allHrefs.some(
        (other) =>
          other !== href &&
          other.startsWith(href + "/") &&
          (pathname === other || pathname.startsWith(other + "/"))
      );
      return !hasMoreSpecificMatch;
    }
    return false;
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-64"
      } h-screen max-h-screen shrink-0 bg-[#0a0a0a] dark:bg-zinc-950 flex flex-col border-r border-white/5 transition-all duration-300 z-50 relative group select-none`}
    >
      {/* Expand/Collapse Toggle Button */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -right-3 top-7 bg-teal-500 hover:bg-teal-400 text-white rounded-full p-1.5 shadow-lg shadow-teal-500/20 z-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Brand Header */}
      <div className="h-20 shrink-0 flex items-center justify-center px-4 border-b border-white/5 bg-white/5 backdrop-blur-md overflow-hidden">
        <span
          className={`text-xl font-black tracking-widest text-white uppercase drop-shadow-md truncate transition-all ${
            isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100 w-auto"
          }`}
        >
          {loading ? "..." : generalConfig?.companyName || "IZAN BLING"}
        </span>
        {isCollapsed && <span className="text-2xl font-black text-teal-500 tracking-tighter">IB</span>}
      </div>

      {/* Scrollable Navigation Container */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {menuGroups.map((group) => {
          const isOpen = openGroups[group.label] !== false;
          return (
            <div key={group.label} className="px-3">
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest mb-2 px-3 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isOpen ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>
              )}

              {(isOpen || isCollapsed) && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={isCollapsed ? item.name : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-teal-500/15 text-teal-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-teal-500/20"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100 border border-transparent"
                        } ${isCollapsed ? "justify-center py-2.5" : ""}`}
                      >
                        <item.icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-teal-400" : "text-zinc-500"
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-4 shrink-0 border-t border-white/5 bg-white/[0.02]">
        <div className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : "px-2"}`}>
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
          {!isCollapsed && (
            <span className="text-xs font-semibold text-zinc-500 tracking-wider truncate">
              SYSTEM ONLINE
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}