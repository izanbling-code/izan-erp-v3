import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ txId: string }> }) {
  try {
    const { txId } = await context.params;
    const tx = await prisma.bankTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error("Transaction not found");

    await prisma.$transaction(async (db) => {
      let newRef = `REV-${tx.reference || tx.id.slice(-6)}`;

      if (tx.reference) {
        const origJe = await db.journalEntry.findFirst({
          where: { entryNo: tx.reference, companyId: tx.companyId },
          include: { lines: true }
        });

        if (origJe) {
          const jeCount = await db.journalEntry.count({ where: { companyId: tx.companyId } });
          const entryNo = `JE-${String(jeCount + 1).padStart(6, '0')}`;
          
          const reverseLines = origJe.lines.map(line => ({
            accountId: line.accountId,
            debit: line.credit, 
            credit: line.debit,
            description: `Reversal: ${line.description}`
          }));

          await db.journalEntry.create({
            data: {
              companyId: tx.companyId,
              entryNo: entryNo,
              entryNumber: entryNo,
              entryDate: new Date(),
              description: `Reversal of ${tx.reference}: ${tx.description}`,
              status: "POSTED",
              lines: { create: reverseLines }
            }
          });
          newRef = entryNo;
        }
      }

      await db.bankTransaction.create({
        data: {
          companyId: tx.companyId,
          bankAccountId: tx.bankAccountId,
          transactionDate: new Date(),
          reference: newRef,
          description: `Reversal: ${tx.description}`,
          instrumentType: tx.instrumentType,
          moneyIn: tx.moneyOut, 
          moneyOut: tx.moneyIn,
          status: "CLEARED" 
        }
      });
    });

    return NextResponse.json({ ok: true, message: "Transaction perfectly reversed" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}