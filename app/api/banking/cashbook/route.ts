import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");

    // Fetch ASSET accounts (which act as Cash/Bank accounts in the existing schema)
    const cashAccounts = await prisma.account.findMany({
      where: { companyId: company.id, type: "ASSET", isActive: true },
      orderBy: { name: "asc" }
    });

    const targetAccountId = accountId || (cashAccounts.length > 0 ? cashAccounts[0].id : null);

    if (!targetAccountId) {
      return NextResponse.json({ ok: true, accounts: cashAccounts, rows: [], openingBalance: 0, closingBalance: 0 });
    }

    // 1. Calculate Opening Balance (Sum of all entries before the 'from' date)
    let openingBalance = 0;
    if (fromDate) {
      const pastLines = await prisma.journalLine.findMany({
        where: {
          accountId: targetAccountId,
          journalEntry: {
            companyId: company.id,
            status: "POSTED",
            entryDate: { lt: new Date(fromDate) }
          }
        }
      });
      // For Assets: Debit increases balance, Credit decreases
      openingBalance = pastLines.reduce((sum, line) => sum + Number(line.debit || 0) - Number(line.credit || 0), 0);
    }

    // 2. Fetch Active Period Transactions
    const currentLines = await prisma.journalLine.findMany({
      where: {
        accountId: targetAccountId,
        journalEntry: {
          companyId: company.id,
          status: "POSTED",
          ...(fromDate || toDate ? {
            entryDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999`) } : {})
            }
          } : {})
        }
      },
      include: { journalEntry: true },
      orderBy: { journalEntry: { entryDate: "asc" } }
    });

    // 3. Calculate Running Balances line by line
    let runningBalance = openingBalance;
    const rows = currentLines.map(line => {
      const moneyIn = Number(line.debit || 0);
      const moneyOut = Number(line.credit || 0);
      runningBalance += (moneyIn - moneyOut);

      return {
        id: line.id,
        date: line.journalEntry.entryDate.toISOString().slice(0, 10),
        reference: line.journalEntry.reference || line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description || "Cash Transaction",
        moneyIn,
        moneyOut,
        balance: runningBalance
      };
    });

    return NextResponse.json({
      ok: true,
      accounts: cashAccounts,
      selectedAccountId: targetAccountId,
      openingBalance,
      closingBalance: runningBalance,
      rows
    });

  } catch (error) {
    console.error("GET /api/banking/cashbook error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load cash book." }, { status: 500 });
  }
}