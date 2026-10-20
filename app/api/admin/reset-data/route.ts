import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = cleanString(body.password);

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Reset password is required" },
        { status: 400 }
      );
    }

    const company = await prisma.company.findFirst();

    if (!company) {
      return NextResponse.json(
        { ok: false, error: "No company configured" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // ---------------------------------------------------------
      // 1. BANKING SUBLEDGER WIPE (NEW)
      // ---------------------------------------------------------
      // Erase all subledger transactions
      await tx.bankTransaction.deleteMany({ where: { companyId: company.id } });
      
      // Store GL Account IDs so we can clean up the Chart of Accounts later
      const banks = await tx.bankAccount.findMany({ where: { companyId: company.id } });
      const bankGlIds = banks.map(b => b.glAccountId).filter(Boolean);
      
      // Erase the Bank Directory
      await tx.bankAccount.deleteMany({ where: { companyId: company.id } });

      // ---------------------------------------------------------
      // 2. EXISTING ERP DATA WIPE
      // ---------------------------------------------------------
      await tx.salesPaymentAllocation.deleteMany();
      await tx.purchasePaymentAllocation.deleteMany();

      await tx.payment.deleteMany({
        where: { companyId: company.id },
      });

      await tx.salesInvoiceLine.deleteMany({
        where: { invoice: { companyId: company.id } },
      });

      await tx.salesInvoice.deleteMany({
        where: { companyId: company.id },
      });

      await tx.purchaseBillLine.deleteMany({
        where: { bill: { companyId: company.id } },
      });

      await tx.purchaseBill.deleteMany({
        where: { companyId: company.id },
      });

      await tx.inventoryMovement.deleteMany({
        where: { companyId: company.id },
      });

      await tx.stockBatch.deleteMany({
        where: { batch: { companyId: company.id } },
      });

      await tx.inventoryBatch.deleteMany({
        where: { companyId: company.id },
      });

      await tx.journalLine.deleteMany({
        where: { journalEntry: { companyId: company.id } },
      });

      await tx.journalEntry.deleteMany({
        where: { companyId: company.id },
      });

      await tx.fiscalPeriod.deleteMany({
        where: { companyId: company.id },
      });

      await tx.stock.updateMany({
        data: {
          quantity: 0,
          averageCost: 0,
        },
      });

      // ---------------------------------------------------------
      // 3. CHART OF ACCOUNTS CLEANUP (NEW)
      // ---------------------------------------------------------
      // Executed last to prevent foreign-key constraint errors with Journal Lines
      if (bankGlIds.length > 0) {
        await tx.account.deleteMany({
          where: { id: { in: bankGlIds } }
        });
      }
    });

    return NextResponse.json({
      ok: true,
      message: "ERP reset successfully. Transactional data, banking subledgers, and stock have been reset.",
    });
  } catch (error) {
    console.error("POST /api/admin/reset-data error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to reset ERP",
      },
      { status: 500 }
    );
  }
}