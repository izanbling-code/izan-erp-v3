import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const { paymentId } = await req.json();
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    
    if (!payment || !payment.journalId) {
      return NextResponse.json({ error: "Invalid payment record" }, { status: 400 });
    }

    const jId = String(payment.journalId);
    
    // TS FIX: Strictly verify and cast the accountId to prevent null-reference compiler errors
    const safeAccountId = payment.accountId ? String(payment.accountId) : undefined;

    await prisma.$transaction(async (db) => {
      // 1. Post to live General Ledger
      const je = await db.journalEntry.update({ where: { id: jId }, data: { status: "POSTED" } });

      // 2. Safely sync to Bank Subledger
      if (safeAccountId) {
        const bankAccount = await db.bankAccount.findUnique({ where: { glAccountId: safeAccountId } });
        if (bankAccount) {
          const existingTx = await db.bankTransaction.findFirst({ where: { reference: je.entryNumber } });
          if (!existingTx) {
            await db.bankTransaction.create({
              data: {
                companyId: payment.companyId,
                bankAccountId: bankAccount.id,
                transactionDate: payment.paymentDate,
                reference: je.entryNumber,
                description: payment.description || `${payment.type === "RECEIPT" ? "Deposit" : "Withdrawal"} — ${je.entryNumber}`,
                instrumentType: payment.method === "CASH" ? "CASH" : "ONLINE_TRANSFER",
                moneyIn: payment.type === "RECEIPT" ? Number(payment.amount) : 0,
                moneyOut: payment.type !== "RECEIPT" ? Number(payment.amount) : 0,
                status: "PENDING"
              }
            });
          }
        }
      }
    });

    return NextResponse.json({ ok: true, message: "Voucher Approved & Posted" });
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}