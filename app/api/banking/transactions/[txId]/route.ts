import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function DELETE(request: NextRequest, context: { params: Promise<{ txId: string }> }) {
  try {
    const { txId } = await context.params;
    const tx = await prisma.bankTransaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error("Transaction not found");

    await prisma.$transaction(async (db) => {
      // 1. Permanently vaporize the linked Journal Entry completely
      if (tx.reference) {
        await db.journalEntry.deleteMany({
          where: { entryNo: tx.reference, companyId: tx.companyId }
        });
      }
      
      // 2. Permanently vaporize the Bank Subledger row
      await db.bankTransaction.delete({ where: { id: txId } });
    });

    return NextResponse.json({ ok: true, message: "Transaction and Journal Entry completely vanished" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}