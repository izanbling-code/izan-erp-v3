import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const ACTIVE_STATUSES: ("POSTED" | "PARTIAL" | "PAID")[] = ["POSTED", "PARTIAL", "PAID"];

async function getCompany() {
  return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function GET() {
  try {
    const company = await getCompany();
    if (!company) {
      return NextResponse.json({ ok: false, error: "No company configured." }, { status: 400 });
    }

    const [salesAgg, purchasesAgg, arAgg, apAgg, liquidAccounts, allEntries, lowStock] = await Promise.all([
      prisma.salesInvoice.aggregate({
        where: { companyId: company.id, status: { in: ACTIVE_STATUSES } },
        _sum: { total: true },
      }),
      prisma.purchaseBill.aggregate({
        where: { companyId: company.id, status: { in: ACTIVE_STATUSES } },
        _sum: { total: true },
      }),
      prisma.salesInvoice.aggregate({
        where: { companyId: company.id, status: { in: ["POSTED", "PARTIAL"] } },
        _sum: { balance: true },
      }),
      prisma.purchaseBill.aggregate({
        where: { companyId: company.id, status: { in: ["POSTED", "PARTIAL"] } },
        _sum: { balance: true },
      }),
      prisma.account.findMany({
        where: { companyId: company.id, type: "ASSET", isActive: true },
        include: {
          journalLines: {
            where: { journalEntry: { status: "POSTED" } },
          },
        },
      }),
      prisma.journalEntry.findMany({
        where: { companyId: company.id, status: "POSTED" },
        include: { lines: { include: { account: true } } },
        orderBy: { entryDate: "asc" },
      }),
      prisma.stock.findMany({
        where: { product: { companyId: company.id }, quantity: { lte: 0 } },
        take: 10,
        select: {
          id: true,
          quantity: true,
          product: { select: { name: true, sku: true, reorderLevel: true } },
          warehouse: { select: { name: true } },
        },
      }),
    ]);

    // Calculate Liquid Cash Balance
    let totalCash = 0;
    for (const acc of liquidAccounts) {
      const name = acc.name.toLowerCase();
      if (
        name.includes("cash") ||
        name.includes("bank") ||
        name.includes("meezan") ||
        name.includes("easypaisa") ||
        name.includes("jazzcash") ||
        acc.code.startsWith("10") ||
        acc.code.startsWith("11")
      ) {
        const net = acc.journalLines.reduce((s, l) => s + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0);
        totalCash += net;
      }
    }

    // P&L and Monthly Aggregations
    let totalIncome = Number(salesAgg._sum.total ?? 0);
    let totalExpenses = Number(purchasesAgg._sum.total ?? 0);
    let totalCogs = 0;
    let totalOperatingExpenses = 0;

    const monthMap = new Map<string, { income: number; expenses: number; cogs: number; netProfit: number; cash: number }>();

    for (const entry of allEntries) {
      const dateStr = new Date(entry.entryDate).toISOString().slice(0, 7); // YYYY-MM
      if (!monthMap.has(dateStr)) {
        monthMap.set(dateStr, { income: 0, expenses: 0, cogs: 0, netProfit: 0, cash: totalCash });
      }
      const mData = monthMap.get(dateStr)!;

      for (const line of entry.lines) {
        const type = String(line.account?.type ?? "");
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);
        const code = line.account?.code ?? "";
        const name = (line.account?.name ?? "").toLowerCase();

        if (type === "REVENUE") {
          mData.income += credit - debit;
        } else if (type === "COST_OF_GOODS_SOLD" || code.startsWith("50") || name.includes("cogs")) {
          mData.cogs += debit - credit;
          totalCogs += debit - credit;
        } else if (type === "EXPENSE") {
          mData.expenses += debit - credit;
          totalOperatingExpenses += debit - credit;
        }
      }
      mData.netProfit = mData.income - (mData.cogs + mData.expenses);
    }

    totalExpenses = totalCogs + totalOperatingExpenses;
    const netProfit = totalIncome - totalExpenses;
    const netProfitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    const grossProfit = totalIncome - totalCogs;

    // Format monthly chart data (last 6-12 months)
    const monthlyTrend = [...monthMap.entries()].sort().slice(-12).map(([key, val]) => {
      const [year, monthNum] = key.split("-");
      const dateObj = new Date(Number(year), Number(monthNum) - 1, 1);
      const label = dateObj.toLocaleString("en", { month: "short" }).toUpperCase();
      return {
        month: label,
        income: Number(val.income.toFixed(2)),
        expenses: Number((val.cogs + val.expenses).toFixed(2)),
        netProfit: Number(val.netProfit.toFixed(2)),
        cash: Number(totalCash.toFixed(2)),
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        totalIncome,
        totalExpenses,
        netProfit,
        netProfitMargin: Number(netProfitMargin.toFixed(1)),
        receivables: Number(arAgg._sum.balance ?? 0),
        payables: Number(apAgg._sum.balance ?? 0),
        cashAtEnd: totalCash,
        grossProfit,
        totalCogs,
        totalOperatingExpenses,
      },
      monthlyTrend,
      lowStock: lowStock.map((row) => ({
        id: row.id,
        product: row.product?.name ?? "Unknown Product",
        sku: row.product?.sku ?? "",
        quantity: Number(row.quantity ?? 0),
        reorderLevel: Number(row.product?.reorderLevel ?? 0),
        warehouse: row.warehouse?.name ?? "",
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
