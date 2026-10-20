import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { companyId: company.id, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: "desc" }
    });

    const enrichedAccounts = await Promise.all(
      bankAccounts.map(async (acc) => {
        const glAccount = await prisma.account.findUnique({
          where: { id: acc.glAccountId },
          select: { id: true, code: true, name: true, isActive: true }
        });

        // Pure fetch only
        const finalTx = await prisma.bankTransaction.findMany({ where: { bankAccountId: acc.id } });
        let clearedBalance = 0; let pendingBalance = 0; let openingBalance = 0;

        for (const tx of finalTx) {
          if (tx.reference && tx.reference.startsWith("OB-")) openingBalance = Number(tx.moneyIn);
          const net = Number(tx.moneyIn || 0) - Number(tx.moneyOut || 0);
          if (tx.status === "CLEARED" || tx.status === "RECONCILED") clearedBalance += net;
          else pendingBalance += net;
        }

        return {
          ...acc, glAccount: glAccount || null, openingBalance, clearedBalance, pendingBalance,
          totalBookBalance: clearedBalance + pendingBalance, transactionCount: finalTx.length
        };
      })
    );
    return NextResponse.json({ ok: true, accounts: enrichedAccounts });
  } catch (error) { return NextResponse.json({ ok: false, error: "Failed to load bank accounts" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company" }, { status: 400 });

    const body = await request.json();
    const { bankName, accountTitle, accountNumber, iban, branchCode, swiftCode, glAccountId, openingBalance, openingBalanceDate } = body;

    const result = await prisma.$transaction(async (tx) => {
      let linkedGlId = glAccountId;

      if (!linkedGlId) {
        const lastAsset = await tx.account.findFirst({ where: { companyId: company.id, type: "ASSET", code: { startsWith: "10" } }, orderBy: { code: "desc" } });
        const nextCodeNum = lastAsset ? parseInt(lastAsset.code, 10) + 1 : 1050;

        const newGl = await tx.account.create({
          data: {
            companyId: company.id, code: isNaN(nextCodeNum) ? `1050` : String(nextCodeNum),
            name: `${bankName.trim()} - ${accountNumber.trim().slice(-4)}`, type: "ASSET",
            description: `Bank account: ${accountTitle} (${accountNumber})`, systemCode: "BANK", isActive: true
          }
        });
        linkedGlId = newGl.id;
      }

      const bankAccount = await tx.bankAccount.create({
        data: {
          companyId: company.id, glAccountId: linkedGlId, bankName: bankName.trim(), accountTitle: accountTitle.trim(),
          accountNumber: accountNumber.trim(), iban: iban?.trim() || null, branchCode: branchCode?.trim() || null, currency: "PKR", isActive: true
        }
      });

      const initBal = Number(openingBalance || 0);
      if (initBal > 0) {
        await tx.bankTransaction.create({
          data: {
            companyId: company.id, bankAccountId: bankAccount.id, transactionDate: openingBalanceDate ? new Date(openingBalanceDate) : new Date(),
            reference: "OPENING-BAL", description: "Initial Opening Balance", instrumentType: "ONLINE_TRANSFER",
            moneyIn: initBal, moneyOut: 0, status: "CLEARED"
          }
        });

        let equityAcc = await tx.account.findFirst({ where: { companyId: company.id, type: "EQUITY", systemCode: "OPENING_BALANCE" } });
        if (!equityAcc) {
          equityAcc = await tx.account.create({ data: { companyId: company.id, code: "3000", name: "Opening Balance Equity", type: "EQUITY", systemCode: "OPENING_BALANCE", isActive: true } });
        }

        const jeCount = await tx.journalEntry.count({ where: { companyId: company.id, entryNumber: { startsWith: "OB-" } } });
        await tx.journalEntry.create({
          data: {
            companyId: company.id, entryNumber: `OB-${new Date().getFullYear()}-${String(jeCount + 1).padStart(4, "0")}`,
            entryDate: openingBalanceDate ? new Date(openingBalanceDate) : new Date(),
            reference: "OPENING-BAL", description: `Opening Balance for ${bankName}`, status: "POSTED", referenceType: "OPENING_BALANCE",
            lines: {
              create: [
                { accountId: linkedGlId, debit: initBal, credit: 0, description: `Opening Balance - ${bankName}` },
                { accountId: equityAcc.id, debit: 0, credit: initBal, description: "Opening Balance Offset" }
              ]
            }
          }
        });
      }
      return bankAccount;
    });

    return NextResponse.json({ ok: true, bankAccount: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to register" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company" }, { status: 400 });

    const body = await request.json();
    const { id, bankName, accountTitle, accountNumber, iban, branchCode, isActive, openingBalance } = body;
    if (!id) return NextResponse.json({ ok: false, error: "Bank ID is required" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.bankAccount.update({
        where: { id },
        data: {
          ...(bankName ? { bankName: bankName.trim() } : {}),
          ...(accountTitle ? { accountTitle: accountTitle.trim() } : {}),
          ...(accountNumber ? { accountNumber: accountNumber.trim() } : {}),
          ...(iban !== undefined ? { iban: iban?.trim() || null } : {}),
          ...(branchCode !== undefined ? { branchCode: branchCode?.trim() || null } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
        }
      });

      if (updated.glAccountId && (bankName || accountNumber)) {
        await tx.account.update({
          where: { id: updated.glAccountId },
          data: { name: `${updated.bankName} - ${updated.accountNumber.slice(-4)}` }
        });
      }

      if (openingBalance !== undefined) {
        const newOb = Number(openingBalance);
        const obTx = await tx.bankTransaction.findFirst({ where: { bankAccountId: id, reference: "OPENING-BAL" } });

        if (obTx) {
          await tx.bankTransaction.update({ where: { id: obTx.id }, data: { moneyIn: newOb } });

          const je = await tx.journalEntry.findFirst({
            where: { companyId: company.id, reference: "OPENING-BAL", lines: { some: { accountId: updated.glAccountId } } },
            include: { lines: true }
          });
          if (je) {
            for (const line of je.lines) {
              if (line.accountId === updated.glAccountId) {
                await tx.journalLine.update({ where: { id: line.id }, data: { debit: newOb } });
              } else {
                await tx.journalLine.update({ where: { id: line.id }, data: { credit: newOb } });
              }
            }
          }
        }
      }

      return updated;
    });

    return NextResponse.json({ ok: true, bankAccount: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "ID is required" }, { status: 400 });

    const bankAccount = await prisma.bankAccount.findUnique({ where: { id } });
    if (!bankAccount) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const txCount = await prisma.bankTransaction.count({ where: { bankAccountId: id } });
    if (txCount > 0) return NextResponse.json({ ok: false, error: "Cannot delete bank with transaction history. Set it to inactive instead." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.bankAccount.delete({ where: { id } });
      await tx.account.delete({ where: { id: bankAccount.glAccountId } }).catch(() => {});
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to delete" }, { status: 500 });
  }
}