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

    const accountMap = new Map<string, {
      accountCode: string;
      accountName: string;
      accountType: string;
      rawDebit: number;
      rawCredit: number;
    }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const id = line.accountId;
        if (!accountMap.has(id)) {
          accountMap.set(id, {
            accountCode: line.account?.code ?? "",
            accountName: line.account?.name ?? "",
            accountType: line.account?.type ?? "",
            rawDebit: 0,
            rawCredit: 0
          });
        }
        const acc = accountMap.get(id)!;
        acc.rawDebit += Number(line.debit ?? 0);
        acc.rawCredit += Number(line.credit ?? 0);
      }
    }

    // Pure 2-column Trial Balance: Net Debit vs Net Credit
    const rows = [...accountMap.values()]
      .map(acc => {
        const diff = acc.rawDebit - acc.rawCredit;
        return {
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          debit: diff > 0 ? diff : 0,
          credit: diff < 0 ? Math.abs(diff) : 0
        };
      })
      .filter(r => r.debit > 0 || r.credit > 0)
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    return NextResponse.json({
      ok: true,
      rows,
      totals: { debit: totalDebit, credit: totalCredit },
      summary: {
        "Total Debit": `Rs ${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Total Credit": `Rs ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        "Difference": `Rs ${Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      }
    });
  } catch (error) {
    console.error("GET /api/reports/trial-balance error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load trial balance" }, { status: 500 });
  }
}
