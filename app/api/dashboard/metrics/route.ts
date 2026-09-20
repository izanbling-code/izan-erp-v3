import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getHierarchicalBalances } from "@/app/lib/financial-engine";

async function getUserContext(request: NextRequest) {
  const sessionCookie = request.cookies.get("ib_session")?.value;
  if (!sessionCookie) return null;
  try {
    const payload = JSON.parse(Buffer.from(sessionCookie, "base64").toString("utf-8"));
    return await prisma.user.findUnique({ where: { id: payload.userId } });
  } catch (e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUserContext(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Core Financial Hierarchies
    const { rootAccounts } = await getHierarchicalBalances(user.companyId);

    let totalRevenue = 0;
    let cogs = 0;
    let opex = 0;
    let accountsReceivable = 0;
    let accountsPayable = 0;
    let liquidCash = 0;

    for (const acc of rootAccounts) {
      const name = acc.name.toLowerCase();
      const code = acc.systemCode || "";

      if (acc.type === "REVENUE") {
        totalRevenue += acc.rolledUpBalance;
      } else if (acc.type === "EXPENSE") {
        if (code === "COGS" || name.includes("cost of goods sold") || name.includes("cogs")) {
          cogs += acc.rolledUpBalance;
        } else {
          opex += acc.rolledUpBalance;
        }
      } else if (acc.type === "ASSET") {
        if (code === "AR" || name.includes("receivable")) accountsReceivable += acc.rolledUpBalance;
        if (code === "CASH" || code === "BANK" || name.includes("cash") || name.includes("bank")) liquidCash += acc.rolledUpBalance;
      } else if (acc.type === "LIABILITY") {
        if (code === "AP" || name.includes("payable")) accountsPayable += acc.rolledUpBalance;
      }
    }

    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - opex;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

    // 2. Real Recent Orders
    const recentOrdersRaw = await prisma.order.findMany({
      where: { companyId: user.companyId },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: true }
    });
    const recentOrders = recentOrdersRaw.map(o => ({
      id: o.orderNumber,
      cust: o.customer?.name || "Walk-in Customer",
      status: o.status,
      total: Number(o.totalAmount)
    }));

    // 3. Real Recent Cash/Bank Transactions
    const recentTxnsRaw = await prisma.payment.findMany({
      where: { companyId: user.companyId },
      take: 5,
      orderBy: { paymentDate: "desc" }
    });
    const recentTransactions = recentTxnsRaw.map(t => ({
      date: t.paymentDate.toISOString().split("T")[0],
      desc: t.description || `${t.type} via ${t.method}`,
      status: "Posted",
      val: Number(t.amount),
      type: t.type === "RECEIPT" ? "pos" : "neg"
    }));

    // 4. Order Status Pie Chart
    const totalOrders = await prisma.order.count({ where: { companyId: user.companyId } });
    const orderStats = await prisma.order.groupBy({
      by: ["status"],
      where: { companyId: user.companyId },
      _count: { id: true }
    });
    
    const statusColors: Record<string, string> = {
      SALE_ORDER: "#0ea5e9",
      CONFIRMATION: "#f59e0b",
      PACKING: "#8b5cf6",
      BOOKED: "#10b981",
      DISPATCHED: "#ef4444"
    };
    
    const pieData = orderStats.map(stat => ({
      name: stat.status.replace("_", " "),
      value: stat._count.id,
      color: statusColors[stat.status] || "#94a3b8"
    }));

    // 5. Real Top Products
    const topProductsRaw = await prisma.orderLine.groupBy({
      by: ["productId"],
      where: { companyId: user.companyId },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 3
    });
    
    const colors = ["bg-emerald-500/20 text-emerald-400", "bg-blue-500/20 text-blue-400", "bg-rose-500/20 text-rose-400"];
    const topProducts = await Promise.all(topProductsRaw.map(async (tp, i) => {
      const p = await prisma.product.findUnique({ where: { id: tp.productId } });
      return {
        name: p?.name || "Unknown Product",
        qty: tp._sum.quantity || 0,
        rev: Number(tp._sum.subtotal || 0),
        color: colors[i] || colors[0]
      };
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalRevenue, cogs, grossProfit, opex, totalExpenses: cogs + opex, netProfit, margin: parseFloat(margin),
        accountsReceivable, accountsPayable, liquidCash,
        totalOrders, recentOrders, recentTransactions, pieData, topProducts
      }
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Failed to calculate metrics" }, { status: 500 });
  }
}