"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, ShoppingCart, Store, 
  FileText, Users, CreditCard,
  ShoppingBag, Truck, Receipt,
  Package, Layers, ArrowRightLeft,
  BookOpen, Landmark, BookMarked, Wallet,
  BarChart3, Calendar, Settings, Shield, Server,
  LogOut
} from "lucide-react";

const menuGroups = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Quick Order", href: "/quick-order", icon: ShoppingCart },
      { name: "Shop", href: "/shop/admin", icon: Store },
    ]
  },
  {
    label: "Sales",
    items: [
      { name: "Invoices", href: "/sales/invoices", icon: FileText },
      { name: "Customers", href: "/sales/customers", icon: Users },
      { name: "Sales Payments", href: "/sales/payments", icon: CreditCard },
    ]
  },
  {
    label: "Purchases",
    items: [
      { name: "Purchase Bills", href: "/purchases/bills", icon: ShoppingBag },
      { name: "Suppliers", href: "/purchases/suppliers", icon: Truck },
      { name: "Payables", href: "/purchases/payables", icon: Receipt },
    ]
  },
  {
    label: "Inventory",
    items: [
      { name: "Products", href: "/inventory/products", icon: Package },
      { name: "Stock & Warehouses", href: "/inventory/stock", icon: Layers },
      { name: "Movements", href: "/inventory/movements", icon: ArrowRightLeft },
    ]
  },
  {
    label: "Finance",
    items: [
      { name: "Chart of Accounts", href: "/accounting/accounts", icon: BookOpen },
      { name: "Banking & Cash", href: "/accounting/banking", icon: Landmark },
      { name: "Journals", href: "/accounting/journals", icon: BookMarked },
      { name: "Payments", href: "/payments", icon: Wallet },
    ]
  },
  {
    label: "Analytics & Misc",
    items: [
      { name: "Reports", href: "/reports", icon: BarChart3 },
      { name: "Events", href: "/events", icon: Calendar },
    ]
  },
  {
    label: "System",
    items: [
      { name: "Users & Roles", href: "/settings/users", icon: Shield },
      { name: "General Settings", href: "/settings", icon: Settings },
      { name: "System Admin", href: "/admin/system", icon: Server },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/unauthorized") return null;

  return (
    <aside className="w-64 hidden md:flex flex-col bg-zinc-950/80 backdrop-blur-2xl border-r border-white/5 h-screen font-sans">
      
      {/* Brand Header */}
      <div className="h-20 flex items-center px-8 border-b border-white/5 bg-zinc-950/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#009b9b] to-[#004e54] flex items-center justify-center font-bold text-white shadow-[0_4px_12px_rgba(0,155,155,0.4)] border border-white/10">
            IB
          </div>
          <span className="text-lg font-black tracking-widest text-white uppercase drop-shadow-sm">
            Izan Bling
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-5 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group text-sm ${
                      isActive 
                        ? "bg-teal-500/10 text-teal-400 font-bold border border-teal-500/20 shadow-[inset_0_0_12px_rgba(20,184,166,0.05)]" 
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 font-medium border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-teal-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-md shrink-0 space-y-3">
        <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 font-bold shrink-0">
            A
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-bold text-white truncate">Admin User</p>
            <p className="text-xs text-zinc-500 truncate">admin@izan.com</p>
          </div>
        </div>
        <a 
          href="/api/auth/logout"
          className="flex items-center justify-center gap-2 w-full bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </a>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); }
      `}} />
    </aside>
  );
}

export function ERPShell({ children }: { children: React.ReactNode }) {
  return <div className="w-full h-full">{children}</div>;
}
