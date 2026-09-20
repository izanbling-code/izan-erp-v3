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

    const rows = entries.flatMap((entry) =>
      entry.lines
        .filter((line) => ["EXPENSE", "COST_OF_GOODS_SOLD"].includes(String(line.account?.type)))
        .map((line) => ({
          date: entry.entryDate,
          journalNumber: entry.entryNumber,
          accountId: line.accountId,
          accountCode: line.account?.code ?? "",
          accountName: line.account?.name ?? "",
          description: line.description,
          amount: Number(line.debit ?? 0) - Number(line.credit ?? 0)
        }))
    );

    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load expense report" }, { status: 500 });
  }
}
