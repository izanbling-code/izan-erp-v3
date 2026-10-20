import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: company.id,
        status: "POSTED",
        ...(from || to ? {
          entryDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {})
          }
        } : {})
      },
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: "asc" }
    });

    const revenues = new Map<string, { code: string; name: string; amount: number }>();
    const cogs = new Map<string, { code: string; name: string; amount: number }>();
    const expenses = new Map<string, { code: string; name: string; amount: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const type = String(line.account?.type ?? "");
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);
        const id = line.accountId;
        const code = line.account?.code ?? "";
        const name = line.account?.name ?? "";

        if (type === "REVENUE") {
          const net = credit - debit;
          if (!revenues.has(id)) revenues.set(id, { code, name, amount: 0 });
          revenues.get(id)!.amount += net;
        } else if (type === "COST_OF_GOODS_SOLD" || code.startsWith("50") || name.toLowerCase().includes("cogs") || name.toLowerCase().includes("cost of goods")) {
          const net = debit - credit;
          if (!cogs.has(id)) cogs.set(id, { code, name, amount: 0 });
          cogs.get(id)!.amount += net;
        } else if (type === "EXPENSE") {
          const net = debit - credit;
          if (!expenses.has(id)) expenses.set(id, { code, name, amount: 0 });
          expenses.get(id)!.amount += net;
        }
      }
    }

    const revenueList = [...revenues.values()].filter(r => r.amount !== 0);
    const cogsList = [...cogs.values()].filter(r => r.amount !== 0);
    const expenseList = [...expenses.values()].filter(r => r.amount !== 0);

    const totalRevenue = revenueList.reduce((s, r) => s + r.amount, 0);
    const totalCogs = cogsList.reduce((s, r) => s + r.amount, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = expenseList.reduce((s, r) => s + r.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    return NextResponse.json({
      ok: true,
      report: {
        revenues: revenueList,
        cogs: cogsList,
        expenses: expenseList,
        totalRevenue,
        totalCogs,
        grossProfit,
        totalExpenses,
        netProfit,
        grossMargin: totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) + "%" : "0.0%",
        netMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) + "%" : "0.0%"
      },
      summary: {
        "Total Revenue": `Rs ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Cost of Goods Sold": `Rs ${totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Gross Profit": `Rs ${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Operating Expenses": `Rs ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Net Profit": `Rs ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      }
    });
  } catch (error) {
    console.error("GET /api/reports/profit-loss error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load P&L statement" }, { status: 500 });
  }
}
