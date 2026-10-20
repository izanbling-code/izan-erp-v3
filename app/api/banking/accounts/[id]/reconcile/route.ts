import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "No Bank ID provided" }, { status: 400 });

    const body = await request.json();
    const { matchedTxIds } = body;

    if (!matchedTxIds || !Array.isArray(matchedTxIds) || matchedTxIds.length === 0) {
      return NextResponse.json({ ok: false, error: "No matching transactions provided to reconcile." }, { status: 400 });
    }

    await prisma.bankTransaction.updateMany({
      where: { id: { in: matchedTxIds }, bankAccountId: id },
      data: { status: "RECONCILED", clearanceDate: new Date() }
    });

    return NextResponse.json({ ok: true, message: `Successfully reconciled ${matchedTxIds.length} transactions.` });
  } catch (error) {
    console.error("Reconciliation API Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to commit reconciliation" }, { status: 500 });
  }
}