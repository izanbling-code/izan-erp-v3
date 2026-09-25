"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, ShoppingBag, Package, Settings2, FileText } from "lucide-react";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function Sidebar() {
  const pathname = usePathname();
  // Consume the General Settings to get the live company name
  const { config, loading } = useERPConfig("general");

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Sales", href: "/sales", icon: ShoppingCart },
    { name: "Purchases", href: "/purchases/bills", icon: ShoppingBag },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Accounting", href: "/accounting", icon: FileText },
    { name: "Settings", href: "/settings", icon: Settings2 },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-[#0a0a0a] dark:bg-zinc-950 flex-col border-r border-white/5 transition-colors z-20">
      
      {/* Dynamic Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/5 bg-white/5 backdrop-blur-md">
        <span className="text-lg font-black tracking-widest text-white uppercase drop-shadow-md truncate">
          {loading ? "..." : (config?.companyName || "IZAN BLING")}
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2 custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive 
                  ? "bg-teal-500/15 text-teal-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] border border-teal-500/20" 
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100 border border-transparent"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-teal-400" : "text-zinc-500"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* Footer System Status */}
      <div className="p-4 border-t border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2 px-2">
          <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wider">SYSTEM ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
