import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "No Bank ID provided" }, { status: 400 });

    const bankAccount = await prisma.bankAccount.findUnique({ where: { id } });
    if (!bankAccount) return NextResponse.json({ ok: false, error: "Bank not found" }, { status: 404 });
    const glAccount = await prisma.account.findUnique({ where: { id: bankAccount.glAccountId } });

    // Pure fetch - absolutely no data injection happens here anymore
    const finalTx = await prisma.bankTransaction.findMany({
      where: { bankAccountId: bankAccount.id },
      orderBy: { transactionDate: "desc" }
    });

    let clearedBalance = 0;
    let pendingBalance = 0;

    finalTx.forEach(tx => {
      const net = Number(tx.moneyIn) - Number(tx.moneyOut);
      if (tx.status === "CLEARED" || tx.status === "RECONCILED") clearedBalance += net;
      else pendingBalance += net;
    });

    return NextResponse.json({
      ok: true,
      bankAccount: { ...bankAccount, glAccount: glAccount || null },
      transactions: finalTx.map(t => ({ ...t, moneyIn: Number(t.moneyIn), moneyOut: Number(t.moneyOut) })),
      clearedBalance,
      pendingBalance,
      totalBookBalance: clearedBalance + pendingBalance
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load bank details" }, { status: 500 });
  }
}