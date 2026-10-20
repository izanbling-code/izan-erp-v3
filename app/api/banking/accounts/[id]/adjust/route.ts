import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "No Bank ID" }, { status: 400 });

    const { date, description, amount, offsetAccountId, isMoneyIn } = await request.json();
    const numAmount = Math.abs(Number(amount));

    if (!offsetAccountId || numAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid adjustment details" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const bank = await tx.bankAccount.findUnique({ where: { id } });
      if (!bank) throw new Error("Bank not found");

      // GL Entry Number
      const year = new Date(date).getFullYear();
      const count = await tx.journalEntry.count({ where: { companyId: bank.companyId, entryNumber: { startsWith: `ADJ-${year}-` } } });
      const entryNumber = `ADJ-${year}-${String(count + 1).padStart(4, "0")}`;

      let debitAccountId = isMoneyIn ? bank.glAccountId : offsetAccountId;
      let creditAccountId = isMoneyIn ? offsetAccountId : bank.glAccountId;

      // Post Journal Entry
      const je = await tx.journalEntry.create({
        data: {
          companyId: bank.companyId, entryNumber, entryDate: new Date(date), reference: "BANK-STMT",
          description: description || "Bank Statement Adjustment", status: "POSTED", referenceType: "ADJUSTMENT",
          lines: {
            create: [
              { accountId: debitAccountId, debit: numAmount, credit: 0, description: description },
              { accountId: creditAccountId, debit: 0, credit: numAmount, description: description }
            ]
          }
        }
      });

      // Post to Subledger
      const newTx = await tx.bankTransaction.create({
        data: {
          companyId: bank.companyId, bankAccountId: bank.id, transactionDate: new Date(date),
          reference: entryNumber, description: description, instrumentType: "BANK_FEE",
          moneyIn: isMoneyIn ? numAmount : 0, moneyOut: isMoneyIn ? 0 : numAmount, status: "MATCHED"
        }
      });

      return newTx;
    });

    return NextResponse.json({ ok: true, transaction: { ...result, net: Number(result.moneyIn) - Number(result.moneyOut) } });
  } catch (error) {
    console.error("Adjust API Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to post adjustment" }, { status: 500 });
  }
}