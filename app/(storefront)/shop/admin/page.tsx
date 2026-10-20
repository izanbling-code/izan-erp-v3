// app/(storefront)/shop/admin/page.tsx
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import { Package, ShoppingCart, Palette, Network, ArrowRight, Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ShopAdminOverviewPage() {
  const company = await prisma.company.findFirst();
  
  // Fetch live stats safely
  const productCount = await prisma.product.count({
    where: { companyId: company?.id, isActive: true }
  }).catch(() => 0);

  const orderCount = await prisma.order.count({
    where: { companyId: company?.id }
  }).catch(() => 0);

  const stats = [
    { label: "Active Products", value: productCount, icon: Package, href: "/shop/admin/products", color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Total Orders", value: orderCount, icon: ShoppingCart, href: "/shop/admin/orders", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Store className="w-8 h-8 text-teal-500" /> Shop Overview
          </h1>
          <p className="text-sm text-slate-500 mt-2">Manage your storefront, catalog, and visual design.</p>
        </div>
        <Link href="/shop" target="_blank" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-zinc-200 dark:text-slate-900 text-white text-sm font-semibold rounded-lg transition-colors">
          Visit Public Store
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all shadow-sm">
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors -translate-x-2 group-hover:translate-x-0" />
            </div>
            <div className="mt-6">
              <h3 className="text-4xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
              <p className="text-sm font-medium text-slate-500 mt-1">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="pt-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/shop/admin/design" className="flex items-center gap-4 p-5 bg-teal-50 dark:bg-teal-500/5 border border-teal-200 dark:border-teal-500/20 rounded-2xl hover:bg-teal-100 dark:hover:bg-teal-500/10 transition-colors group">
            <div className="p-3 bg-teal-500 text-white rounded-xl shadow-lg shadow-teal-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-teal-900 dark:text-teal-400">Storefront Design</h3>
              <p className="text-xs text-teal-700 dark:text-teal-500/70 mt-0.5">Edit your homepage sections and layout</p>
            </div>
          </Link>

          <Link href="/shop/admin/funnels" className="flex items-center gap-4 p-5 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-500/10 transition-colors group">
            <div className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-indigo-900 dark:text-indigo-400">Guided Funnels</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-500/70 mt-0.5">Manage your first-visit quiz questions</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}