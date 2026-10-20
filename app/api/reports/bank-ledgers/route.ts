import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId: company.id }
    });

    const allTransactions = await prisma.bankTransaction.findMany({
      where: { companyId: company.id },
      orderBy: { transactionDate: 'desc' }
    });

    const banks = bankAccounts.map(bank => ({
      ...bank,
      transactions: allTransactions.filter(tx => tx.bankAccountId === bank.id)
    }));

    return NextResponse.json({ ok: true, banks });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}