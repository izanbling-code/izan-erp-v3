import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const customers = await prisma.customer.findMany({
      where: {
        companyId: company.id,
        ...(search ? { OR: [ { name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } } ] } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, customers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load customers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Customer name is required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const openingBalance = Number(body.openingBalance) || 0;
    const asOfDate = body.asOfDate ? new Date(body.asOfDate) : new Date();

    const customerData = {
      companyId: company.id, name,
      email: body.email?.trim() || null, phone: body.phone?.trim() || null,
      address: body.address?.trim() || null, city: body.city?.trim() || null,
      taxNumber: body.taxNumber?.trim() || null, openingBalance
    };

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({ data: customerData });

      if (openingBalance > 0) {
        const settings = await tx.companySettings.findUnique({ where: { companyId: company.id } });
        const arAccountId = (settings?.accounting as any)?.accountsReceivableAccountId;
        
        if (!arAccountId) throw new Error("Please map an 'Accounts Receivable' GL Account in Settings > Accounting before adding opening balances.");

        let equityAcc = await tx.account.findFirst({ where: { companyId: company.id, systemCode: "OPENING_BALANCE_EQUITY" } });
        if (!equityAcc) {
          equityAcc = await tx.account.create({
            data: { companyId: company.id, name: "Opening Balance Equity", code: "3999", type: "EQUITY", systemCode: "OPENING_BALANCE_EQUITY", isActive: true }
          });
        }

        const latestJE = await tx.journalEntry.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
        const match = latestJE?.entryNumber?.match(/JE-(\d+)/);
        const eNum = match ? `JE-${String(Number(match[1]) + 1).padStart(6, "0")}` : "JE-000001";

        await tx.journalEntry.create({
          data: {
            companyId: company.id, entryNumber: eNum, entryDate: asOfDate, status: "POSTED", reference: `CUST-${customer.name}`, referenceType: "SALE", description: `Customer Opening Balance - ${customer.name}`,
            lines: { create: [
              { accountId: arAccountId, debit: openingBalance, credit: 0, description: "Customer Opening Balance" },
              { accountId: equityAcc.id, debit: 0, credit: openingBalance, description: "Opening Balance Setup" }
            ]}
          }
        });
      }
      return customer;
    });

    return NextResponse.json({ ok: true, customer: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to create customer" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || !body.name) return NextResponse.json({ ok: false, error: "ID and name are required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const customer = await prisma.customer.update({
      where: { id: body.id, companyId: company.id },
      data: {
        name: body.name.trim(), email: body.email?.trim() || null, phone: body.phone?.trim() || null,
        address: body.address?.trim() || null, city: body.city?.trim() || null,
        taxNumber: body.taxNumber?.trim() || null, status: body.status || "ACTIVE"
      }
    });

    return NextResponse.json({ ok: true, customer, message: "Customer updated successfully." });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to update customer" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ ok: false, error: "Customer ID required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    await prisma.customer.delete({ where: { id: body.id, companyId: company.id } });

    return NextResponse.json({ ok: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json({ ok: false, error: "Cannot delete customer: They have existing invoices or receipts in the ledger." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to delete customer" }, { status: 500 });
  }
}