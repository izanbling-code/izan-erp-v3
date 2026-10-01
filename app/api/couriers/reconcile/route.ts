import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courierId, items } = body; 
    
    if (!items || items.length === 0) return NextResponse.json({ success: false, error: "No invoices selected" });

    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ success: false, error: "Company not found" });

    const settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    const acc = (settings?.accounting as any) || {};
    const sales = (settings?.sales as any) || {};

    const courierCollectionId = sales.courierCollectionAccount || acc.courierCollectionAccount;
    const courierPayableId = sales.courierPayableAccount || acc.courierPayableAccount;
    const deliveryIncomeId = sales.deliveryIncomeAccount || acc.deliveryIncomeAccount;
    const deliveryExpenseId = sales.deliveryExpenseAccount || acc.deliveryExpenseAccount;
    const courierDepositId = sales.courierDepositAccount || acc.courierDepositAccount; // <-- The new dynamic bank account

    if (!courierCollectionId || !courierPayableId || !deliveryIncomeId || !deliveryExpenseId || !courierDepositId) {
      return NextResponse.json({ success: false, error: "Courier GL mappings (including Deposit Account) are incomplete in Settings." });
    }

    const invoiceIds = items.map((i: any) => i.id);
    const invoices = await prisma.salesInvoice.findMany({ where: { id: { in: invoiceIds } } });
    const batchRef = `REC-${Math.floor(Date.now() / 1000)}`;

    await prisma.$transaction(async (tx) => {
      let totalCOD = 0;
      let totalBilledFee = 0;
      let totalActualFee = 0;

      for (const item of items) {
        const inv = invoices.find(i => i.id === item.id);
        if (!inv) continue;

        totalCOD += Number(inv.total);
        totalBilledFee += Number(inv.deliveryCharges);
        totalActualFee += Number(item.actualFee);

        await tx.salesInvoice.update({
          where: { id: inv.id },
          data: { status: "RECONCILED", balance: 0, paid: inv.total } 
        });
      }

      const netRemittance = totalCOD - totalActualFee;
      const variance = totalBilledFee - totalActualFee;

      const jLines = [];
      
      // 1. Receive Funds into the Mapped Bank/Cash Account
      if (netRemittance > 0) {
        jLines.push({ accountId: courierDepositId, debit: netRemittance, credit: 0, description: "Courier COD Remittance" });
      }
      
      // 2. Clear the Payable Liability (Reversing the billed fee)
      if (totalBilledFee > 0) {
        jLines.push({ accountId: courierPayableId, debit: totalBilledFee, credit: 0, description: "Clear Courier Payable" });
      }
      
      // 3. Clear the Asset Receivable (Reversing the gross COD)
      if (totalCOD > 0) {
        jLines.push({ accountId: courierCollectionId, debit: 0, credit: totalCOD, description: "Clear Courier Collection" });
      }

      // 4. Book the Variance (Income or Expense)
      if (variance > 0) {
        jLines.push({ accountId: deliveryIncomeId, debit: 0, credit: variance, description: "Delivery Profit Variance" });
      } else if (variance < 0) {
        jLines.push({ accountId: deliveryExpenseId, debit: Math.abs(variance), credit: 0, description: "Delivery Loss Variance" });
      }

      await tx.journalEntry.create({
        data: {
          companyId: company.id, entryNumber: batchRef, entryDate: new Date(), status: "POSTED", referenceType: "PAYMENT", reference: batchRef, description: `Courier Settlement - ${batchRef}`,
          lines: { create: jLines }
        }
      });
    });

    return NextResponse.json({ success: true, batchRef });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
