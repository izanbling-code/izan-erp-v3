"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { ShoppingCart, Package, Users, FileText, TrendingUp, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { config: appearance } = useERPConfig("appearance");
  const { formatAmount, currency } = useERPConfig("general");
  const { showKpis = true, showSalesChart = true, showStockChart = true, showActivity = true, showCategories = true } = appearance?.dashboard || {};

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/metric")
      .then(res => res.json())
      .then(json => {
        if (json.ok) setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const generateChartPath = (dataPoints: number[], width: number, height: number, maxVal: number) => {
    if (!dataPoints || dataPoints.length === 0) return "";
    const stepX = width / (dataPoints.length - 1);
    const points = dataPoints.map((val, i) => {
      const x = i * stepX;
      const y = height - ((val / maxVal) * height);
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-pulse text-teal-600 font-bold tracking-widest uppercase flex items-center gap-3">
          <TrendingUp className="w-5 h-5 animate-bounce" /> Syncing Live Metrics...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-500">
        <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Failed to load metrics</h2>
        <p className="text-sm mt-1">Check your database connection.</p>
      </div>
    );
  }

  const chartWidth = 1000;
  const chartHeight = 260;
  const maxSales = Math.max(...data.charts.salesVsOrders.sales, ...data.charts.salesVsOrders.orders) * 1.2 || 1;
  const salesPath = generateChartPath(data.charts.salesVsOrders.sales, chartWidth, chartHeight, maxSales);
  const ordersPath = generateChartPath(data.charts.salesVsOrders.orders, chartWidth, chartHeight, maxSales);
  const catMax = Math.max(...data.categories.map((c: any) => c.value)) || 1;

  return (
    <div className="space-y-6 relative z-10 w-full pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
        <div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Live Business Overview</h1></div>
        <select className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm outline-none focus:border-teal-500 transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900">
          <option>This Month</option>
        </select>
      </div>

      {showKpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard href="/sales" title="ORDERS" icon={<ShoppingCart className="w-5 h-5 text-cyan-500" />} iconBg="bg-cyan-50 dark:bg-cyan-500/10 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/20" mainValue={data.kpis.ordersToday.toString()} mainLabel="Today" subValue={data.kpis.pendingOrders.toString()} subLabel="Pending" subColor="text-cyan-500" hoverBorder="group-hover:border-cyan-500/30" />
          <KPICard href="/inventory/products" title="INVENTORY" icon={<Package className="w-5 h-5 text-emerald-500" />} iconBg="bg-emerald-50 dark:bg-emerald-500/10 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20" mainValue={`${currency} ${formatAmount(data.kpis.inventoryValue)}`} mainLabel="Stock Value" subValue={`${data.kpis.lowStockItems} Items`} subLabel="Low Stock" subColor="text-emerald-500" hoverBorder="group-hover:border-emerald-500/30" />
          <KPICard href="/sales/customers" title="CUSTOMER CREDIT" icon={<Users className="w-5 h-5 text-slate-500 dark:text-slate-400" />} iconBg="bg-slate-100 dark:bg-white/5 group-hover:bg-slate-200 dark:group-hover:bg-white/10" mainValue={`${currency} ${formatAmount(data.kpis.receivables)}`} mainLabel="Receivables" subValue={`${currency} ${formatAmount(data.kpis.overdue)}`} subLabel="Est. Overdue" subColor="text-rose-500" hoverBorder="group-hover:border-slate-500/30" />
          <KPICard href="/purchases" title="PURCHASING" icon={<FileText className="w-5 h-5 text-slate-400 dark:text-zinc-500" />} iconBg="bg-slate-50 dark:bg-white/5 group-hover:bg-slate-100 dark:group-hover:bg-white/10" mainValue={data.kpis.openPOs.toString()} mainLabel="Open POs" subValue={`${currency} ${formatAmount(data.kpis.poValue)}`} subLabel="PO Value" subColor="text-slate-500 dark:text-zinc-400" hoverBorder="group-hover:border-slate-500/30" />
          <KPICard href="/reports/sales" title="SALES" icon={<TrendingUp className="w-5 h-5 text-teal-500" />} iconBg="bg-teal-50 dark:bg-teal-500/10 group-hover:bg-teal-100 dark:group-hover:bg-teal-500/20" mainValue={`${currency} ${formatAmount(data.kpis.salesThisMonth)}`} mainLabel="This Month" subValue={`${data.kpis.salesGrowth > 0 ? '+' : ''}${data.kpis.salesGrowth.toFixed(1)}%`} subLabel="Growth" subColor={data.kpis.salesGrowth >= 0 ? "text-teal-500" : "text-rose-500"} hoverBorder="group-hover:border-teal-500/30" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {showSalesChart && (
          <div className="lg:col-span-2 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-900 dark:text-white">Sales vs Orders Trend</h3>
              <div className="flex gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-500"></div> Sales</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Orders</span>
              </div>
            </div>
            <div className="flex-1 w-full min-h-[220px] relative mt-2">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full h-full ml-4 preserve-aspect-ratio-none overflow-visible">
                {/* Sales Line - Teal */}
                <path d={salesPath} fill="none" stroke="#14b8a6" strokeWidth="4" className="drop-shadow-[0_4px_6px_rgba(20,184,166,0.2)]" strokeLinecap="round" strokeLinejoin="round" />
                {/* Orders Line - Cyan */}
                <path d={ordersPath} fill="none" stroke="#06b6d4" strokeWidth="4" className="drop-shadow-[0_4px_6px_rgba(6,182,212,0.2)]" strokeLinecap="round" strokeLinejoin="round" />
                {/* Gradients */}
                <path d={`${salesPath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`} fill="url(#teal-gradient)" opacity="0.15" />
                <path d={`${ordersPath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`} fill="url(#cyan-gradient)" opacity="0.1" />
                <defs>
                  <linearGradient id="teal-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" /><stop offset="100%" stopColor="transparent" /></linearGradient>
                  <linearGradient id="cyan-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="transparent" /></linearGradient>
                </defs>
              </svg>
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500 mt-2 ml-4">
                {data.charts.salesVsOrders.labels.map((l: string) => <span key={l}>{l}</span>)}
              </div>
            </div>
          </div>
        )}

        {showStockChart && (
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 flex flex-col hover:border-emerald-500/30 transition-colors cursor-pointer" onClick={() => window.location.href = '/reports/inventory'}>
            <h3 className="font-bold text-slate-900 dark:text-white mb-8">Warehouse Stock Status</h3>
            <div className="flex-1 flex items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-48 h-48 -rotate-90 drop-shadow-lg">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="16" className="text-slate-100 dark:text-white/5" />
                {data.charts.warehouse.total > 0 && (
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#10b981" strokeWidth="16" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * (data.charts.warehouse.available / data.charts.warehouse.total))} className="transition-all duration-1000" />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">{data.charts.warehouse.total.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">Units</span>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> <span className="text-slate-600 dark:text-zinc-400 font-medium">Available</span></span><span className="font-bold text-slate-900 dark:text-white">{data.charts.warehouse.available.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-zinc-600"></div> <span className="text-slate-600 dark:text-zinc-400 font-medium">Reserved</span></span><span className="font-bold text-slate-900 dark:text-white">{data.charts.warehouse.reserved.toLocaleString()}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-100 dark:bg-white/5"></div> <span className="text-slate-600 dark:text-zinc-400 font-medium">Incoming</span></span><span className="font-bold text-slate-900 dark:text-white">{data.charts.warehouse.incoming.toLocaleString()}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {showActivity && (
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Recent System Activity</h3>
            <div className="space-y-6">
              {data.activity.map((act: any, i: number) => {
                // Remap legacy random colors to the new Glass palette based on index
                const glassColors = ["bg-teal-500", "bg-cyan-500", "bg-emerald-500", "bg-slate-400 dark:bg-zinc-500"];
                const dotColor = glassColors[i % glassColors.length];
                return (
                  <div key={i} className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor} shadow-[0_0_8px_rgba(20,184,166,0.3)]`} />
                      <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 transition-colors">{act.title}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">{act.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showCategories && (
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5">
            <h3 className="font-bold text-slate-900 dark:text-white mb-6">Top Product Categories (Sales Value)</h3>
            <div className="space-y-5">
              {data.categories.map((cat: any, i: number) => {
                // Refined Glass Palette for bars
                const colors = ["bg-teal-500", "bg-emerald-500", "bg-cyan-500", "bg-slate-300 dark:bg-zinc-600"];
                const width = `${Math.min((cat.value / catMax) * 100, 100)}%`;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">{cat.label}</span>
                      <span className="font-mono font-medium text-slate-500 dark:text-zinc-400">{currency} {formatAmount(cat.value)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${colors[i % colors.length]} rounded-full transition-all duration-1000 ease-out`} style={{ width }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ href, title, icon, iconBg, mainValue, mainLabel, subValue, subLabel, subColor, hoverBorder }: { href: string, title: string, icon: any, iconBg: string, mainValue: string, mainLabel: string, subValue: string, subLabel: string, subColor: string, hoverBorder: string }) {
  return (
    <Link href={href} className="block group">
      <div className={`bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-5 rounded-2xl shadow-sm border border-slate-200/80 dark:border-white/5 flex flex-col gap-4 transition-all duration-300 group-hover:-translate-y-1 ${hoverBorder} group-hover:shadow-md cursor-pointer h-full`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest transition-colors">{title}</span>
          <div className={`p-1.5 rounded-lg transition-colors ${iconBg}`}>{icon}</div>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-1 font-medium">{mainLabel}</p>
          <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate" title={mainValue}>{mainValue}</h4>
        </div>
        <div className="flex justify-between items-end mt-auto pt-2 border-t border-slate-100 dark:border-white/5">
          <span className="text-[11px] text-slate-500 dark:text-zinc-500">{subLabel}</span>
          <span className={`text-xs font-bold ${subColor}`}>{subValue}</span>
        </div>
      </div>
    </Link>
  );
}
