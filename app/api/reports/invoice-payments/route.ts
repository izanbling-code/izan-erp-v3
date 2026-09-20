import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("Company not found");

    const payments = await prisma.payment.findMany({
      where: { companyId: company.id },
      orderBy: { paymentDate: 'desc' }
    });

    const customers = await prisma.customer.findMany({ where: { companyId: company.id } });
    const invoices = await prisma.salesInvoice.findMany({ where: { companyId: company.id } });
    const bankAccounts = await prisma.bankAccount.findMany({ where: { companyId: company.id } });
    
    const journals = await prisma.journalEntry.findMany({
      where: { companyId: company.id, entryNo: { in: payments.map(p => p.paymentNo) } },
      include: { lines: { include: { account: true } } }
    });

    const reportData = payments.map((p: any) => {
      const je = journals.find(j => j.entryNo === p.paymentNo);
      const debitLine = je?.lines.find(l => Number(l.debit) > 0);
      const matchedBank = bankAccounts.find(b => b.glAccountId === debitLine?.accountId);
      
      const customer = customers.find(c => c.id === p.customerId);
      const invoice = invoices.find(inv => inv.id === p.invoiceId || inv.id === p.salesInvoiceId);

      return {
        id: p.id,
        paymentNo: p.paymentNo,
        date: p.paymentDate,
        customerName: customer?.name || "Walk-in / Unknown",
        invoiceNo: invoice?.invoiceNo || (p.description ? p.description.substring(0, 30) : "N/A"),
        amountPaid: p.amount,
        destinationAccount: matchedBank ? `Bank: ${matchedBank.bankName} (${matchedBank.accountTitle})` : (debitLine ? `${debitLine.account.code} - ${debitLine.account.name}` : "General Cash/Bank")
      };
    });

    return NextResponse.json({ ok: true, data: reportData });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}