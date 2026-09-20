import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    let deletedGhosts = 0;
    let deletedDupes = 0;

    // 1. Delete manual ghosts (REC-, PAY-, EXP-)
    const ghosts = await prisma.bankTransaction.deleteMany({
      where: { OR: [ { reference: { startsWith: "REC-" } }, { reference: { startsWith: "PAY-" } }, { reference: { startsWith: "EXP-" } } ] }
    });
    deletedGhosts = ghosts.count;

    // 2. Deduplicate CRV and CPV race conditions
    const allTx = await prisma.bankTransaction.findMany({ 
      where: { reference: { not: null } },
      orderBy: { createdAt: 'asc' } // Keep the original, delete the clone
    });
    
    const seen = new Set();
    for (const tx of allTx) {
      if (tx.reference && (tx.reference.startsWith("CRV-") || tx.reference.startsWith("CPV-"))) {
        if (seen.has(tx.reference)) {
          await prisma.bankTransaction.delete({ where: { id: tx.id } });
          deletedDupes++;
        } else {
          seen.add(tx.reference);
        }
      }
    }

    return NextResponse.json({ 
      ok: true, 
      message: `SUCCESS: Vaporized ${deletedGhosts} old ghosts and merged ${deletedDupes} CRV/CPV duplicates!` 
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}