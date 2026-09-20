import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { name, phone, address, city, cart, totalAmount } = await request.json();

    if (!name || !phone || !address || !cart || cart.length === 0) {
      return NextResponse.json({ error: "Missing required contact details or cart items" }, { status: 400 });
    }

    // Find the first available company in the DB to associate public store orders
    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ error: "No company configured" }, { status: 500 });
    }

    const order = await prisma.$transaction(async (tx) => {
      // 1. Create or update customer record automatically from public checkout
      let customer = await tx.customer.findFirst({
        where: { companyId: company.id, phone }
      });

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { name, address, city }
        });
      } else {
        customer = await tx.customer.create({
          data: { companyId: company.id, name, phone, address, city }
        });
      }

      // 2. Generate sequential order number
      let counter = await tx.sequenceCounter.findUnique({
        where: { tenantId_model: { tenantId: company.id, model: "Order" } }
      });
      
      let currentVal = 1;
      if (counter) {
        currentVal = counter.nextVal;
        await tx.sequenceCounter.update({
          where: { id: counter.id },
          data: { nextVal: currentVal + 1 }
        });
      } else {
        await tx.sequenceCounter.create({
          data: { tenantId: company.id, model: "Order", prefix: "ORD-", nextVal: 2 }
        });
      }
      
      const orderNum = `ORD-${String(currentVal).padStart(6, '0')}`;

      // 3. Create the Order in Pending status
      const newOrder = await tx.order.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          orderNumber: orderNum,
          status: "SALE_ORDER",
          totalAmount,
          lines: {
            create: cart.map((item: any) => ({
              productId: item.id,
              companyId: company.id,
              quantity: item.qty,
              unitPrice: item.price,
              subtotal: item.price * item.qty
            }))
          }
        }
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("Shop Checkout Error:", error);
    return NextResponse.json({ error: "Failed to process shop checkout" }, { status: 500 });
  }
}