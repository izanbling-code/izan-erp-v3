"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, Search, Settings, Bell } from "lucide-react";

// Zeroed-out baseline arrays for an empty database
const emptyTrend = [
  { name: "Mon", val: 0 }, { name: "Tue", val: 0 }, { name: "Wed", val: 0 }, 
  { name: "Thu", val: 0 }, { name: "Fri", val: 0 }, { name: "Sat", val: 0 }, { name: "Sun", val: 0 }
];

const emptyMainChart = [
  { day: "1", rev: 0, profit: 0 }, { day: "5", rev: 0, profit: 0 }, { day: "10", rev: 0, profit: 0 }, 
  { day: "15", rev: 0, profit: 0 }, { day: "20", rev: 0, profit: 0 }, { day: "25", rev: 0, profit: 0 }, { day: "30", rev: 0, profit: 0 }
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/dashboard/metrics")
      .then(res => res.json())
      .then(data => {
        if (data.success) setMetrics(data.metrics);
        setLoading(false);
      });
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(val || 0).replace("PKR", "Rs");
  };

  if (!mounted) return null;

  // Use API historical data if it exists, otherwise fall back to the accurate zero-state
  const revenueData = metrics?.historicalRevenue || emptyTrend;
  const salesData = metrics?.historicalSales || emptyTrend;
  const profitData = metrics?.historicalProfit || emptyTrend;
  const expenseData = metrics?.historicalExpense || emptyTrend;
  const mainChartData = metrics?.historicalMain || emptyMainChart;

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 p-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Admin!</h1>
          <p className="text-sm text-slate-400 mt-1">Here is your live ERP business snapshot</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search orders, transactions..." className="bg-[#172136] border border-slate-700/50 text-sm rounded-full pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 w-64 transition-all" />
          </div>
          <button className="p-2 text-slate-400 hover:text-white bg-[#172136] rounded-full"><Bell className="w-4 h-4" /></button>
          <button className="p-2 text-slate-400 hover:text-white bg-[#172136] rounded-full"><Settings className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-[#131C2F] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Revenue</p>
              <h2 className="text-2xl font-bold text-white mt-1">{loading ? "..." : formatCurrency(metrics?.totalRevenue)}</h2>
              <p className="text-emerald-400 text-xs font-medium mt-1 flex items-center gap-1">Live Ledger</p>
            </div>
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">Rs</span>
          </div>
          <div className="h-12 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={revenueData}><Line type="monotone" dataKey="val" stroke="#10b981" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#131C2F] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Orders</p>
              <h2 className="text-2xl font-bold text-white mt-1">{loading ? "..." : metrics?.totalOrders || 0} Orders</h2>
              <p className="text-emerald-400 text-xs font-medium mt-1 flex items-center gap-1">All Channels</p>
            </div>
            <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">📦</span>
          </div>
          <div className="h-12 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={salesData}><Bar dataKey="val" fill="#3b82f6" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#131C2F] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Gross Profit</p>
              <h2 className="text-2xl font-bold text-white mt-1">{loading ? "..." : formatCurrency(metrics?.grossProfit)}</h2>
              <p className="text-emerald-400 text-xs font-medium mt-1 flex items-center gap-1">COGS Deducted</p>
            </div>
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">📈</span>
          </div>
          <div className="h-12 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={profitData}><Bar dataKey="val" fill="#10b981" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#131C2F] p-5 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Expenses</p>
              <h2 className="text-2xl font-bold text-white mt-1">{loading ? "..." : formatCurrency(metrics?.totalExpenses)}</h2>
              <p className="text-rose-400 text-xs font-medium mt-1 flex items-center gap-1">OPEX + COGS</p>
            </div>
            <span className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">📉</span>
          </div>
          <div className="h-12 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={expenseData}><Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-[#131C2F] p-6 rounded-2xl border border-slate-800 shadow-lg lg:col-span-2">
          <h3 className="text-sm font-bold text-white mb-6">Revenue vs Accounting Profit</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mainChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0B1121", border: "1px solid #1e293b", borderRadius: "8px" }} itemStyle={{ color: "#e2e8f0" }} />
                <Line type="monotone" dataKey="rev" name="Revenue" stroke="#3b82f6" strokeWidth={3} dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-[#131C2F] p-6 rounded-2xl border border-slate-800 shadow-lg flex-1">
            <h3 className="text-sm font-bold text-white mb-2">Orders by Status</h3>
            <div className="h-40 flex items-center justify-center relative">
              {metrics?.pieData?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={metrics.pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                      {metrics.pieData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-slate-800 flex items-center justify-center"></div>
              )}
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold text-white">{metrics?.totalOrders || 0}</span>
                <span className="text-[10px] text-slate-400">Total</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(metrics?.pieData || []).map((item: any) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-slate-300 truncate w-16">{item.name}</span>
                  </div>
                  <span className="font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#131C2F] p-6 rounded-2xl border border-slate-800 shadow-lg flex-1">
            <h3 className="text-sm font-bold text-white mb-4">Top Selling Products</h3>
            <div className="space-y-4">
              {metrics?.topProducts?.length > 0 ? (
                metrics.topProducts.map((prod: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${prod.color}`}>
                        {prod.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white truncate w-32">{prod.name}</p>
                        <p className="text-xs text-slate-500">Qty: {prod.qty}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white">{formatCurrency(prod.rev)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No product data yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}