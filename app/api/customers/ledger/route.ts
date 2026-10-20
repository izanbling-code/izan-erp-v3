import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Customer ID is required" }, { status: 400 });

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });

    const invoices = await prisma.salesInvoice.findMany({
      where: { customerId: id, status: { in: ["POSTED", "PARTIAL", "PAID"] } }
    });

    const payments = await prisma.payment.findMany({
      where: { OR: [ { customerId: id }, { salesAllocations: { some: { invoice: { customerId: id } } } } ] },
      include: { salesAllocations: { include: { invoice: true } } }
    });

    let transactions: any[] = [];

    // BREAK DOWN EACH INVOICE INTO BASE, DELIVERY, AND DISCOUNT
    invoices.forEach(inv => {
      // Safely extract fields (handling different potential schema naming conventions)
      const discount = Number((inv as any).discount || (inv as any).discountAmount || 0);
      const delivery = Number((inv as any).shipping || (inv as any).deliveryCharges || (inv as any).deliveryFee || 0);
      
      // The Base Amount is the Gross Total minus delivery, plus the discount that was applied
      const baseAmount = Number(inv.total) - delivery + discount;

      // Row 1: Base Invoice Amount (Debit)
      if (baseAmount > 0) {
        transactions.push({
          id: `${inv.id}-base`, date: inv.invoiceDate, type: "INVOICE", reference: inv.invoiceNo,
          description: `Sales Invoice (Items Total)`, debit: baseAmount, credit: 0
        });
      }

      // Row 2: Delivery Charges (Debit)
      if (delivery > 0) {
        transactions.push({
          id: `${inv.id}-delivery`, date: inv.invoiceDate, type: "DELIVERY", reference: inv.invoiceNo,
          description: `Delivery & Shipping Charges`, debit: delivery, credit: 0
        });
      }

      // Row 3: Discount Applied (Credit)
      if (discount > 0) {
        transactions.push({
          id: `${inv.id}-discount`, date: inv.invoiceDate, type: "DISCOUNT", reference: inv.invoiceNo,
          description: `Discount Applied`, debit: 0, credit: discount
        });
      }
    });

    // PROCESS RECEIPTS
    payments.forEach(p => {
      let invRefs = p.salesAllocations?.map((a: any) => a.invoice?.invoiceNo).filter(Boolean).join(', ');
      let desc = `Payment Received ${p.method ? '['+p.method+']' : ''} ${p.reference ? '(Ref: ' + p.reference + ')' : ''}`;
      if (invRefs) desc += ` applied to ${invRefs}`;

      if (!transactions.find(t => t.id === p.id)) {
        transactions.push({
          id: p.id, date: p.paymentDate, type: "RECEIPT", reference: p.paymentNo,
          description: desc.trim(), debit: 0, credit: Number(p.amount)
        });
      }
    });

    // Sort chronologically. If dates match, ensure Invoice Base comes before Delivery/Discount.
    transactions.sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Secondary sort to keep invoice components grouped logically
      const order: any = { "INVOICE": 1, "DELIVERY": 2, "DISCOUNT": 3, "RECEIPT": 4 };
      return order[a.type] - order[b.type];
    });

    return NextResponse.json({ ok: true, customer, transactions });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}