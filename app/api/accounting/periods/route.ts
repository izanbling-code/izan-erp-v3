import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

async function getCompany() {
  return prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function GET() {
  try {
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    let periods = await prisma.fiscalPeriod.findMany({
      where: { companyId: company.id },
      orderBy: { startDate: "asc" },
    });

    // Auto-seed current year months if empty
    if (periods.length === 0) {
      const year = new Date().getFullYear();
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];

      for (let i = 0; i < 12; i++) {
        const start = new Date(year, i, 1);
        const end = new Date(year, i + 1, 0, 23, 59, 59, 999);
        await prisma.fiscalPeriod.create({
          data: {
            companyId: company.id,
            name: `${months[i]} ${year}`,
            startDate: start,
            endDate: end,
            status: "OPEN",
          },
        });
      }

      periods = await prisma.fiscalPeriod.findMany({
        where: { companyId: company.id },
        orderBy: { startDate: "asc" },
      });
    }

    return NextResponse.json({ ok: true, periods });
  } catch (error) {
    console.error("GET /api/accounting/periods error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to load periods" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const company = await getCompany();
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const { periodId, status } = await request.json();
    if (!periodId || !status) {
      return NextResponse.json({ ok: false, error: "Period ID and status are required" }, { status: 400 });
    }

    // Fetch the period to get exact date boundaries
    const period = await prisma.fiscalPeriod.findUnique({
      where: { id: periodId, companyId: company.id }
    });

    if (!period) return NextResponse.json({ ok: false, error: "Fiscal period not found" }, { status: 404 });

    // ==========================================
    // 🛡️ ENTERPRISE CLOSING VALIDATION SUITE
    // ==========================================
    if (status === "CLOSED") {
      const validationErrors: string[] = [];

      // 1. ACTIVE CHECK: Block if there are unposted journal entries in this month
      const unpostedJournals = await prisma.journalEntry.count({
        where: {
          companyId: company.id,
          entryDate: { gte: period.startDate, lte: period.endDate },
          status: { not: "POSTED" } 
        }
      });
      if (unpostedJournals > 0) {
        validationErrors.push(`Found ${unpostedJournals} unposted journal entry/entries. All journals must be posted.`);
      }

      // ---------------------------------------------------------
      // FUTURE IMPLEMENTATIONS (Uncomment as modules are built)
      // ---------------------------------------------------------
      
      /*
      // 2. DRAFT INVOICES CHECK
      const draftInvoices = await prisma.salesInvoice.count({
        where: { companyId: company.id, issueDate: { gte: period.startDate, lte: period.endDate }, status: "DRAFT" }
      });
      if (draftInvoices > 0) validationErrors.push(`Found ${draftInvoices} draft sales invoices.`);

      // 3. DRAFT BILLS CHECK
      const draftBills = await prisma.purchaseBill.count({
        where: { companyId: company.id, billDate: { gte: period.startDate, lte: period.endDate }, status: "DRAFT" }
      });
      if (draftBills > 0) validationErrors.push(`Found ${draftBills} draft purchase bills.`);

      // 4. BANK RECONCILIATION CHECK
      // validationErrors.push("Bank accounts have not been reconciled for this period.");

      // 5. DEPRECIATION RUN CHECK
      // validationErrors.push("Fixed asset depreciation has not been calculated for this month.");
      */

      // If any checks fail, abort the closing and return the report
      if (validationErrors.length > 0) {
        return NextResponse.json({ 
          ok: false, 
          error: "Cannot close period due to pending financial tasks.", 
          details: validationErrors 
        }, { status: 400 });
      }
    }

    // ==========================================
    // 🔒 LOCK THE PERIOD
    // ==========================================
    const updated = await prisma.fiscalPeriod.update({
      where: { id: periodId, companyId: company.id },
      data: {
        status,
        closedAt: status === "CLOSED" ? new Date() : null,
        closedBy: status === "CLOSED" ? "Administrator" : null,
      },
    });

    return NextResponse.json({ ok: true, period: updated, message: `Fiscal period successfully updated to ${status}.` });
  } catch (error) {
    console.error("POST /api/accounting/periods error:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed to update period" }, { status: 500 });
  }
}