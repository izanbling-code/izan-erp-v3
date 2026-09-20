import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Supplier ID is required" }, { status: 400 });

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return NextResponse.json({ ok: false, error: "Supplier not found" }, { status: 404 });

    // 1. Fetch Bills (These INCREASE what you owe - Credit)
    const bills = await prisma.purchaseBill.findMany({
      where: { supplierId: id, status: { in: ["POSTED", "PARTIAL", "PAID"] } }
    });

    // 2. Fetch New Engine Payments (These DECREASE what you owe - Debit)
    const payments = await prisma.supplierPayment.findMany({
      where: { supplierId: id, status: "POSTED" }
    });

    // 3. Fetch Historical Legacy Payments (Before the new Payables Engine was built)
    const legacyPayments = await prisma.payment.findMany({
      where: {
        OR: [
          { supplierId: id },
          { purchaseAllocations: { some: { bill: { supplierId: id } } } }
        ]
      },
      include: { purchaseAllocations: { include: { bill: true } } }
    });

    let transactions: any[] = [];

    bills.forEach(b => {
      transactions.push({
        id: b.id, date: b.billDate, type: "BILL", reference: b.billNo,
        description: `Purchase Bill`, debit: 0, credit: Number(b.total)
      });
    });

    payments.forEach(p => {
      transactions.push({
        id: p.id, date: p.date, type: "PAYMENT", reference: p.paymentNumber,
        description: `Payment Disbursed ${p.method ? '['+p.method+']' : ''} ${p.referenceNo ? '(Ref: ' + p.referenceNo + ')' : ''}`,
        debit: Number(p.amount), credit: 0
      });
    });

    legacyPayments.forEach(p => {
      let billRefs = p.purchaseAllocations?.map((a: any) => a.bill?.billNo).filter(Boolean).join(', ');
      let desc = `Legacy Payment ${p.method ? '['+p.method+']' : ''} ${p.reference ? '(Ref: ' + p.reference + ')' : ''}`;
      if (billRefs) desc += ` applied to ${billRefs}`;

      if (!transactions.find(t => t.id === p.id)) {
        transactions.push({
          id: p.id, date: p.paymentDate, type: "PAYMENT", reference: p.paymentNo,
          description: desc.trim(),
          debit: Number(p.amount), credit: 0
        });
      }
    });

    // Sort chronologically
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ ok: true, supplier, transactions });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}