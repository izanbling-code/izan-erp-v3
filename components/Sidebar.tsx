"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, ShoppingCart, Store, 
  FileText, Users, CreditCard,
  ShoppingBag, Truck, Receipt,
  Package, Layers, ArrowRightLeft,
  BookOpen, Landmark, BookMarked, Wallet,
  BarChart3, Calendar, Settings, Shield, Server
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
    <aside className="w-64 hidden md:flex flex-col bg-[#0B1121] border-r border-slate-800/60 h-screen font-sans">
      <div className="h-20 flex items-center px-8 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            IB
          </div>
          <span className="text-lg font-black tracking-widest text-white uppercase">
            Izan Bling
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-5 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
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
                        ? "bg-blue-600/10 text-blue-400 font-bold" 
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 font-medium"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/60 shrink-0">
        <div className="bg-[#131C2F] p-3 rounded-xl border border-slate-800/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold shrink-0">
            A
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">Admin User</p>
            <p className="text-xs text-slate-500 truncate">admin@izan.com</p>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.4); border-radius: 8px; margin-block: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.8); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 1); }
      `}} />
    </aside>
  );
}