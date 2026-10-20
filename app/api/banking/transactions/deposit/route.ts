import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { bankAccountId, creditAccountId, amount, description, date } = await req.json();
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    
    if (!bankAccount) throw new Error("Bank account not found");
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    await prisma.$transaction(async (db) => {
      // 1. Create the Balanced Journal Entry
      const jeCount = await db.journalEntry.count({ where: { companyId: company.id } });
      const entryNo = `JE-${String(jeCount + 1).padStart(6, '0')}`;

      await db.journalEntry.create({
        data: {
          companyId: company.id,
          entryNo: entryNo,
          entryNumber: entryNo,
          entryDate: new Date(date),
          description: `Direct Deposit: ${description}`,
          status: "POSTED",
          lines: {
            create: [
              { accountId: bankAccount.glAccountId, debit: Number(amount), credit: 0, description },
              { accountId: creditAccountId, debit: 0, credit: Number(amount), description }
            ]
          }
        }
      });

      // 2. Create the Bank Subledger Row
      await db.bankTransaction.create({
        data: {
          companyId: company.id,
          bankAccountId: bankAccount.id,
          transactionDate: new Date(date),
          reference: entryNo,
          description: description,
          instrumentType: "ONLINE_TRANSFER",
          moneyIn: Number(amount),
          moneyOut: 0,
          status: "CLEARED" // Auto-cleared for immediate balance availability
        }
      });
    });

    return NextResponse.json({ ok: true, message: "Deposit successful" });
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}