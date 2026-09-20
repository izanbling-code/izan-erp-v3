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

    const balances = new Map<string, any>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const id = line.accountId;
        if (!balances.has(id)) {
          balances.set(id, {
            accountId: id,
            accountCode: line.account?.code ?? "",
            accountName: line.account?.name ?? "",
            accountType: line.account?.type ?? "",
            debit: 0,
            credit: 0,
            balance: 0
          });
        }

        const row = balances.get(id);
        row.debit += Number(line.debit ?? 0);
        row.credit += Number(line.credit ?? 0);
      }
    }

    for (const row of balances.values()) {
      row.balance = row.debit - row.credit;
    }

    return NextResponse.json({ ok: true, rows: [...balances.values()] });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load account balances" }, { status: 500 });
  }
}
