import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, cashAccountId, offsetAccountId, amount, date, reference, description } = body;

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const numAmount = Number(amount);
    if (!cashAccountId || !offsetAccountId || numAmount <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid transaction details" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const year = new Date(date).getFullYear();
      const prefix = type === "CRV" ? `CRV-${year}-` : type === "CPV" ? `CPV-${year}-` : `CTV-${year}-`;
      
      const count = await tx.journalEntry.count({ where: { companyId: company.id, entryNumber: { startsWith: prefix } } });
      const entryNumber = `${prefix}${String(count + 1).padStart(4, "0")}`;

      // 1. Determine the exact flow of money
      let debitAccountId = "";
      let creditAccountId = "";

      if (type === "CRV") {
        // Receive Cash: Debit Cash Account, Credit Offset (Revenue/Customer)
        debitAccountId = cashAccountId;
        creditAccountId = offsetAccountId;
      } else if (type === "CPV") {
        // Pay Cash: Credit Cash Account, Debit Offset (Expense/Vendor)
        debitAccountId = offsetAccountId;
        creditAccountId = cashAccountId;
      } else if (type === "CTV") {
        // Transfer Out: Credit Active Account, Debit Target (Offset) Account
        debitAccountId = offsetAccountId;
        creditAccountId = cashAccountId;
      }

      // 2. Post to the strict General Ledger
      const je = await tx.journalEntry.create({
        data: {
          companyId: company.id, entryNumber, entryDate: new Date(date), reference: reference || "",
          description: description || `${type} Voucher`, status: "POSTED", referenceType: type === "CTV" ? "TRANSFER" : "VOUCHER",
          lines: {
            create: [
              { accountId: debitAccountId, debit: numAmount, credit: 0, description: description || "Money In (Debit)" },
              { accountId: creditAccountId, debit: 0, credit: numAmount, description: description || "Money Out (Credit)" }
            ]
          }
        }
      });

      // ---------------------------------------------------------
      // 3. THE SUBLEDGER INTERCEPTOR (BANK DIRECTORY SYNC)
      // ---------------------------------------------------------
      const targetBank = await tx.bankAccount.findUnique({ where: { glAccountId: debitAccountId } });
      const sourceBank = await tx.bankAccount.findUnique({ where: { glAccountId: creditAccountId } });

      // If the receiving account is a registered Bank, record the deposit
      if (targetBank) {
        await tx.bankTransaction.create({
          data: {
            companyId: company.id, bankAccountId: targetBank.id, transactionDate: new Date(date),
            reference: entryNumber, description: description || "Transfer In / Deposit", instrumentType: "ONLINE_TRANSFER",
            moneyIn: numAmount, moneyOut: 0, status: "CLEARED"
          }
        });
      }

      // If the sending account is a registered Bank, record the withdrawal
      if (sourceBank) {
        await tx.bankTransaction.create({
          data: {
            companyId: company.id, bankAccountId: sourceBank.id, transactionDate: new Date(date),
            reference: entryNumber, description: description || "Transfer Out / Payment", instrumentType: "ONLINE_TRANSFER",
            moneyIn: 0, moneyOut: numAmount, status: "CLEARED"
          }
        });
      }

      return je;
    });

    return NextResponse.json({ ok: true, message: "Voucher posted safely to GL and Subledgers." });
  } catch (error) {
    console.error("Voucher API Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to post voucher" }, { status: 500 });
  }
}