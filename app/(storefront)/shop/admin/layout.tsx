"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Palette,
  Tag,
  Settings,
  Store,
  ArrowLeft,
  Network,
} from "lucide-react";

const sidebarLinks = [
  { name: "Overview", href: "/shop/admin", icon: LayoutDashboard },
  { name: "Product Catalog", href: "/shop/admin/products", icon: Package },
  { name: "Orders & Returns", href: "/shop/admin/orders", icon: ShoppingCart },
  { name: "Storefront Design", href: "/shop/admin/design", icon: Palette },
  { name: "Guided Funnels (Quiz)", href: "/shop/admin/funnels", icon: Network },
  { name: "Discounts", href: "/shop/admin/discounts", icon: Tag },
  { name: "Store Settings", href: "/shop/admin/settings", icon: Settings },
];

// Routes that should take over the full screen without the sidebar
const FULLSCREEN_ROUTES = ["/shop/admin/design"];

export default function ShopAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFullscreen = FULLSCREEN_ROUTES.some(
    (r) => pathname === r || pathname?.startsWith(r + "/")
  );

  // If we are on the Design page, render it without the sidebar so the Canva editor gets full width
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 text-zinc-100 overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] bg-slate-50 dark:bg-zinc-950 overflow-hidden w-full">
      {/* Shop Admin Sidebar */}
      <aside className="w-64 min-w-[16rem] shrink-0 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-white/5 flex-col hidden md:flex z-10">
        <div className="p-6 border-b border-slate-200 dark:border-white/5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 whitespace-nowrap">
            <Store className="w-5 h-5 text-teal-500" />
            Shop Admin
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
          {sidebarLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/shop/admin" && pathname?.startsWith(link.href + "/"));
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition-colors text-sm whitespace-nowrap ${
                  isActive
                    ?"bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-300 font-sans antialiased transition-colors duration-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-zinc-950/50">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to ERP
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50 relative custom-scrollbar">
        <div className="p-6 md:p-8 w-full max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.4); border-radius: 8px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.6); }
      `}} />
    </div>
  );
}