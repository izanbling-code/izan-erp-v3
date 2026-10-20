import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// GET: Fetch all historical withdrawals
export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: false, error: "No company" }, { status: 400 });

    const withdrawals = await prisma.journalEntry.findMany({
      where: { companyId: company.id, referenceType: "WITHDRAWAL" },
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: "desc" }
    });

    const formatted = withdrawals.map(w => {
      // Safely cast Prisma Decimals to Numbers for comparison
      const drawingsLine = w.lines.find(l => Number(l.debit) > 0);
      const assetLine = w.lines.find(l => Number(l.credit) > 0);
      
      return {
        id: w.id,
        entryNumber: w.entryNumber,
        date: w.entryDate,
        amount: drawingsLine ? Number(drawingsLine.debit) : 0,
        sourceAccount: assetLine?.account.name || "Unknown",
        description: w.description
      };
    });

    return NextResponse.json({ ok: true, withdrawals: formatted });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load withdrawals" }, { status: 500 });
  }
}

// POST: Process a new Owner Withdrawal
export async function POST(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: false, error: "No company" }, { status: 400 });

    const { sourceAccountId, amount, date, reference, description } = await request.json();
    const numAmount = Number(amount);

    if (!sourceAccountId || numAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid withdrawal details" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Ensure the Drawings Equity Account exists
      let drawingsAcc = await tx.account.findFirst({ where: { companyId: company.id, systemCode: "DRAWINGS" } });
      if (!drawingsAcc) {
        drawingsAcc = await tx.account.create({
          data: {
            companyId: company.id, code: "3050", name: "Owner's Drawings & Distributions",
            type: "EQUITY", systemCode: "DRAWINGS", isActive: true
          }
        });
      }

      // 2. Generate Withdrawal Voucher (WD)
      const year = new Date(date).getFullYear();
      const count = await tx.journalEntry.count({ where: { companyId: company.id, entryNumber: { startsWith: `WD-${year}-` } } });
      const entryNumber = `WD-${year}-${String(count + 1).padStart(4, "0")}`;

      const je = await tx.journalEntry.create({
        data: {
          companyId: company.id, entryNumber, entryDate: new Date(date), reference: reference || "",
          description: description || "Owner Profit Withdrawal", status: "POSTED", referenceType: "WITHDRAWAL",
          lines: {
            create: [
              { accountId: drawingsAcc.id, debit: numAmount, credit: 0, description: "Equity Deduction (Drawings)" },
              { accountId: sourceAccountId, debit: 0, credit: numAmount, description: "Asset Deduction (Withdrawal)" }
            ]
          }
        }
      });

      // 3. Bank Subledger Interceptor
      const sourceBank = await tx.bankAccount.findUnique({ where: { glAccountId: sourceAccountId } });
      if (sourceBank) {
        await tx.bankTransaction.create({
          data: {
            companyId: company.id, bankAccountId: sourceBank.id, transactionDate: new Date(date),
            reference: entryNumber, description: description || "Owner Profit Withdrawal", instrumentType: "ONLINE_TRANSFER",
            moneyIn: 0, moneyOut: numAmount, status: "CLEARED"
          }
        });
      }

      return je;
    });

    return NextResponse.json({ ok: true, message: "Withdrawal successfully processed and recorded to Equity." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to process withdrawal" }, { status: 500 });
  }
}