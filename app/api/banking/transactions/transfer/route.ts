import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { sourceBankId, destBankId, amount, date, description } = await req.json();
    
    const sourceBank = await prisma.bankAccount.findUnique({ where: { id: sourceBankId } });
    const destBank = await prisma.bankAccount.findUnique({ where: { id: destBankId } });

    if (!sourceBank || !destBank) throw new Error("Bank account(s) not found");
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const transferAmount = Number(amount);
    const defaultDesc = `Transfer from ${sourceBank.bankName} to ${destBank.bankName}`;
    const finalDesc = description ? `${defaultDesc} - ${description}` : defaultDesc;

    await prisma.$transaction(async (db) => {
      // 1. Create the double-entry Journal Entry (Debit Dest, Credit Source)
      const jeCount = await db.journalEntry.count({ where: { companyId: company.id } });
      const entryNo = `JE-${String(jeCount + 1).padStart(6, '0')}`;

      await db.journalEntry.create({
        data: {
          companyId: company.id,
          entryNo: entryNo,
          entryNumber: entryNo,
          entryDate: new Date(date),
          description: finalDesc,
          status: "POSTED",
          lines: {
            create: [
              { accountId: destBank.glAccountId, debit: transferAmount, credit: 0, description: finalDesc },
              { accountId: sourceBank.glAccountId, debit: 0, credit: transferAmount, description: finalDesc }
            ]
          }
        }
      });

      // 2. Withdraw from Source Bank Subledger
      await db.bankTransaction.create({
        data: {
          companyId: company.id,
          bankAccountId: sourceBank.id,
          transactionDate: new Date(date),
          reference: entryNo,
          description: finalDesc,
          instrumentType: "ONLINE_TRANSFER",
          moneyIn: 0,
          moneyOut: transferAmount,
          status: "CLEARED" 
        }
      });

      // 3. Deposit into Destination Bank Subledger
      await db.bankTransaction.create({
        data: {
          companyId: company.id,
          bankAccountId: destBank.id,
          transactionDate: new Date(date),
          reference: entryNo,
          description: finalDesc,
          instrumentType: "ONLINE_TRANSFER",
          moneyIn: transferAmount,
          moneyOut: 0,
          status: "CLEARED" 
        }
      });
    });

    return NextResponse.json({ ok: true, message: "Transfer successful" });
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}