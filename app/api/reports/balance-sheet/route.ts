import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const to = searchParams.get("to");

    // Retrieve all posted journal entries up to the target date
    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: company.id,
        status: "POSTED",
        ...(to ? { entryDate: { lte: new Date(`${to}T23:59:59.999`) } } : {})
      },
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: "asc" }
    });

    const accountBalances = new Map<string, {
      id: string;
      code: string;
      name: string;
      type: string;
      debit: number;
      credit: number;
      balance: number;
    }>();

    let totalRevenue = 0;
    let totalCogsAndExpenses = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        const type = String(line.account?.type ?? "");
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);

        // Track P&L accounts for dynamic Retained Earnings calculation
        if (type === "REVENUE") {
          totalRevenue += credit - debit;
        } else if (type === "EXPENSE" || type === "COST_OF_GOODS_SOLD") {
          totalCogsAndExpenses += debit - credit;
        }

        // Track Balance Sheet Accounts
        if (["ASSET", "LIABILITY", "EQUITY"].includes(type)) {
          const id = line.accountId;
          if (!accountBalances.has(id)) {
            accountBalances.set(id, {
              id,
              code: line.account?.code ?? "",
              name: line.account?.name ?? "",
              type,
              debit: 0,
              credit: 0,
              balance: 0
            });
          }
          const row = accountBalances.get(id)!;
          row.debit += debit;
          row.credit += credit;
        }
      }
    }

    const netIncome = totalRevenue - totalCogsAndExpenses;

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const acc of accountBalances.values()) {
      if (acc.type === "ASSET") {
        acc.balance = acc.debit - acc.credit;
        if (Math.abs(acc.balance) > 0.001) {
          assets.push(acc);
          totalAssets += acc.balance;
        }
      } else if (acc.type === "LIABILITY") {
        acc.balance = acc.credit - acc.debit;
        if (Math.abs(acc.balance) > 0.001) {
          liabilities.push(acc);
          totalLiabilities += acc.balance;
        }
      } else if (acc.type === "EQUITY") {
        acc.balance = acc.credit - acc.debit;
        if (Math.abs(acc.balance) > 0.001) {
          equity.push(acc);
          totalEquity += acc.balance;
        }
      }
    }

    // Add Dynamic Current Period Earnings to Equity
    equity.push({
      id: "net-period-income",
      code: "3999",
      name: "Current Period Net Profit / (Loss)",
      type: "EQUITY",
      balance: netIncome
    });
    totalEquity += netIncome;

    return NextResponse.json({
      ok: true,
      report: {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
      },
      summary: {
        "Total Assets": `Rs ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Total Liabilities": `Rs ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Total Equity": `Rs ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Balance Equality": Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? "Balanced (Assets = L + E)" : "Out of Balance"
      }
    });
  } catch (error) {
    console.error("GET /api/reports/balance-sheet error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load balance sheet" }, { status: 500 });
  }
}
