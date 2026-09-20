import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const { searchParams } = new URL(req.url);
    const bankId = searchParams.get("bankId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const whereClause: any = { companyId: company.id, moneyIn: { gt: 0 } };

    // Apply Bank Filter
    if (bankId && bankId !== "all") {
      whereClause.bankAccountId = bankId;
    }

    // Apply Date Filters
    if (startDate || endDate) {
      whereClause.transactionDate = {};
      if (startDate) whereClause.transactionDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        whereClause.transactionDate.lte = end;
      }
    }

    const deposits = await prisma.bankTransaction.findMany({
      where: whereClause,
      orderBy: { transactionDate: 'desc' }
    });

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId: company.id }
    });

    const references = deposits.map(d => d.reference).filter(Boolean) as string[];
    const journals = await prisma.journalEntry.findMany({
      where: { companyId: company.id, entryNo: { in: references } },
      include: { lines: { include: { account: true } } }
    });

    const reportData = deposits.map(dep => {
      const je = journals.find(j => j.entryNo === dep.reference);
      const sourceLine = je?.lines.find(l => Number(l.credit) > 0);
      const bank = bankAccounts.find(b => b.id === dep.bankAccountId);
      
      return {
        id: dep.id,
        date: dep.transactionDate,
        bankName: bank?.bankName || "Unknown Bank",
        accountTitle: bank?.accountTitle || "Unknown Account",
        reference: dep.reference || "N/A",
        description: dep.description,
        amount: dep.moneyIn,
        sourceAccount: sourceLine ? `${sourceLine.account.code} - ${sourceLine.account.name}` : "Unknown Source",
        status: dep.status
      };
    });

    return NextResponse.json({ ok: true, data: reportData });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}