import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const suppliers = await prisma.supplier.findMany({
      where: {
        companyId: company.id,
        ...(search ? { OR: [ { name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } } ] } : {}),
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ ok: true, suppliers });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to load suppliers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Supplier name is required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const openingBalance = Number(body.openingBalance) || 0;
    const asOfDate = body.asOfDate ? new Date(body.asOfDate) : new Date();

    const supplierData = {
      companyId: company.id, name,
      email: body.email?.trim() || null, phone: body.phone?.trim() || null,
      address: body.address?.trim() || null, city: body.city?.trim() || null,
      taxNumber: body.taxNumber?.trim() || null, openingBalance
    };

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({ data: supplierData });

      if (openingBalance > 0) {
        const settings = await tx.companySettings.findUnique({ where: { companyId: company.id } });
        const apAccountId = (settings?.accounting as any)?.accountsPayableAccountId;
        
        if (!apAccountId) throw new Error("Please map an 'Accounts Payable' GL Account in Settings > Accounting before adding opening balances.");

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
            companyId: company.id, entryNumber: eNum, entryDate: asOfDate, status: "POSTED", reference: `SUPP-${supplier.name}`, referenceType: "PURCHASE", description: `Supplier Opening Balance - ${supplier.name}`,
            lines: { create: [
              { accountId: equityAcc.id, debit: openingBalance, credit: 0, description: "Opening Balance Setup" },
              { accountId: apAccountId, debit: 0, credit: openingBalance, description: "Supplier Opening Balance" }
            ]}
          }
        });
      }
      return supplier;
    });

    return NextResponse.json({ ok: true, supplier: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to create supplier" }, { status: 500 });
  }
}
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id || !body.name) return NextResponse.json({ ok: false, error: "ID and name are required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const supplier = await prisma.supplier.update({
      where: { id: body.id, companyId: company.id },
      data: {
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        taxNumber: body.taxNumber?.trim() || null
      }
    });

    return NextResponse.json({ ok: true, supplier, message: "Supplier updated successfully." });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ ok: false, error: "Supplier ID required" }, { status: 400 });

    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    await prisma.supplier.delete({
      where: { id: body.id, companyId: company.id }
    });

    return NextResponse.json({ ok: true, message: "Supplier deleted successfully" });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json({ ok: false, error: "Cannot delete supplier: They have existing bills or payments in the ledger." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to delete supplier" }, { status: 500 });
  }
}
