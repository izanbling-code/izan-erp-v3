import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const event = await prisma.eventPlanner.findUnique({
      where: { id: eventId },
      include: { sales: { include: { items: true } }, items: true }
    });
    if (!event) throw new Error("Event not found");
    if (event.status === "POSTED") throw new Error("Event already posted to ERP!");

    const totalRevenue = event.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    if (totalRevenue === 0) throw new Error("No sales to import");

    const actualCOGS = event.sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, saleItem) => {
        const origItem = event.items.find(i => i.id === saleItem.itemId);
        return itemSum + (saleItem.quantity * Number(origItem?.unitCost || 0));
      }, 0);
    }, 0);

    let customer = await prisma.customer.findFirst({ where: { companyId: company.id, name: "Pop-up Walk-in" } });
    if (!customer) customer = await prisma.customer.create({ data: { companyId: company.id, name: "Pop-up Walk-in" } });

    let product = await prisma.product.findFirst({ where: { companyId: company.id, sku: "POPUP-BULK" } });
    if (!product) product = await prisma.product.create({ data: { companyId: company.id, name: "Bulk Event Sales", sku: "POPUP-BULK", type: "SERVICE" } });

    const settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    const acc = (settings?.accounting as any) || {};

    // Mapped exactly to the frontend JSON keys
    const arId = acc.accountsReceivableAccountId;
    const revId = acc.defaultSalesAccountId;
    const cogsId = acc.defaultCogsAccountId;
    const invId = acc.defaultInventoryAccountId;

    if (!arId || !revId || !cogsId || !invId) {
      throw new Error(`Settings missing. Please save Default Accounts in Company Settings. Found keys: ${Object.keys(acc).join(", ")}`);
    }

    await prisma.$transaction(async (db) => {
      const jeCount = await db.journalEntry.count({ where: { companyId: company.id } });
      const entryNo = `JE-${String(jeCount + 1).padStart(6, '0')}`;

      const journalLines = [
        { accountId: arId, debit: totalRevenue, credit: 0, description: `AR - ${event.name}` },
        { accountId: revId, debit: 0, credit: totalRevenue, description: `Revenue - ${event.name}` }
      ];

      if (actualCOGS > 0) {
        journalLines.push({ accountId: cogsId, debit: actualCOGS, credit: 0, description: `COGS - ${event.name}` });
        journalLines.push({ accountId: invId, debit: 0, credit: actualCOGS, description: `Inventory Reduction - ${event.name}` });
      }

      const journal = await db.journalEntry.create({
        data: {
          companyId: company.id,
          entryNo: entryNo,
          entryNumber: entryNo,
          entryDate: new Date(),
          description: `Event Import: ${event.name}`,
          status: "POSTED",
          lines: { create: journalLines }
        }
      });

      const invoiceCount = await db.salesInvoice.count({ where: { companyId: company.id } });
      await db.salesInvoice.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          invoiceNo: `INV-POPUP-${invoiceCount + 1}`,
          invoiceDate: new Date(),
          status: "POSTED",
          subtotal: totalRevenue,
          total: totalRevenue,
          paid: 0,
          balance: totalRevenue,
          notes: `Event: ${event.name}. Please record payment manually against this invoice.`,
          journalId: journal.id,
          lines: { create: [{ productId: product.id, quantity: 1, unitPrice: totalRevenue, total: totalRevenue }] }
        }
      });

      await db.eventPlanner.update({ where: { id: eventId }, data: { status: "POSTED" } });
    });

    return NextResponse.json({ ok: true, message: "Sync successful" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}