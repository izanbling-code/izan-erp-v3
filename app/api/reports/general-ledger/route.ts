import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // 1. Fetch all accounts, explicitly requesting 'parentId' to build the COA tree
    const accounts = await prisma.account.findMany({
      where: { companyId: company.id, isActive: true },
      select: { id: true, code: true, name: true, type: true, parentId: true },
      orderBy: { code: "asc" }
    });

    const targetAccountId = accountId || (accounts.length > 0 ? accounts[0].id : null);

    if (!targetAccountId) {
      return NextResponse.json({ ok: true, accounts: [], rows: [], closingBalance: 0 });
    }

    // 2. ROLL-UP ENGINE: Recursively map the parent account and all its descendants
    const targetAccountIds = new Set<string>();
    targetAccountIds.add(targetAccountId);

    function attachChildren(parentId: string) {
      const children = accounts.filter(a => a.parentId === parentId);
      for (const child of children) {
        if (!targetAccountIds.has(child.id)) {
          targetAccountIds.add(child.id);
          attachChildren(child.id); // Crawl deeper for sub-sub-accounts
        }
      }
    }
    attachChildren(targetAccountId);
    
    const activeIds = Array.from(targetAccountIds);

    // 3. Query the ledger for ANY account in the mapped tree
    const entries = await prisma.journalEntry.findMany({
      where: {
        companyId: company.id,
        status: "POSTED",
        ...(from || to ? {
          entryDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {})
          }
        } : {}),
        lines: { some: { accountId: { in: activeIds } } }
      },
      include: { lines: { where: { accountId: { in: activeIds } }, include: { account: true } } },
      orderBy: { entryDate: "asc" }
    });

    let runningBalance = 0;

    const rows = entries.flatMap(entry =>
      entry.lines.map(line => {
        const debit = Number(line.debit ?? 0);
        const credit = Number(line.credit ?? 0);
        const type = line.account?.type;

        if (type === "ASSET" || type === "EXPENSE") {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }

        return {
          date: entry.entryDate.toISOString().slice(0, 10),
          journalNumber: entry.entryNumber,
          reference: entry.reference || "—",
          // The UI will distinctly show which specific sub-account this line hit
          account: `${line.account?.code} - ${line.account?.name}`,
          description: line.description || entry.description || "General Entry",
          debit,
          credit,
          balance: runningBalance
        };
      })
    );

    const selectedAcc = accounts.find(a => a.id === targetAccountId);

    return NextResponse.json({
      ok: true,
      accounts,
      selectedAccountId: targetAccountId,
      selectedAccountName: selectedAcc ? `${selectedAcc.code} — ${selectedAcc.name}` : "",
      rows,
      closingBalance: runningBalance,
      summary: {
        totalDebit: rows.reduce((acc, row) => acc + row.debit, 0),
        totalCredit: rows.reduce((acc, row) => acc + row.credit, 0)
      }
    });
  } catch (error) {
    console.error("Ledger API Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load ledger" }, { status: 500 });
  }
}