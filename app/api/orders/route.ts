import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

async function getUserContext(request: NextRequest) {
  const sessionCookie = request.cookies.get("ib_session")?.value;
  if (!sessionCookie) return null;
  try {
    const payload = JSON.parse(Buffer.from(sessionCookie, "base64").toString("utf-8"));
    return await prisma.user.findUnique({ where: { id: payload.userId } });
  } catch (e) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUserContext(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const orders = await prisma.order.findMany({
      where: { companyId: user.companyId },
      include: { customer: true, lines: { include: { product: true } } },
      orderBy: { createdAt: "desc" }
    });
    const customers = await prisma.customer.findMany({ where: { companyId: user.companyId } });
    const products = await prisma.product.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: { stock: true }
    });
    
    // Fetch Shipper / Company Information for the Receipt
    const company = await prisma.company.findUnique({
      where: { id: user.companyId }
    });

    return NextResponse.json({ success: true, orders, customers, products, company });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch pipeline data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserContext(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { customerId, cart, totalAmount } = await request.json();
    
    // Wrap in a transaction to lock the Sequence Counter and ensure sequential IDs
    const newOrder = await prisma.$transaction(async (tx) => {
      let counter = await tx.sequenceCounter.findUnique({
        where: { tenantId_model: { tenantId: user.companyId, model: "Order" } }
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
          data: { tenantId: user.companyId, model: "Order", prefix: "ORD-", nextVal: 2 }
        });
      }
      
      // Pad to 6 digits (e.g., ORD-000001)
      const orderNum = `ORD-${String(currentVal).padStart(6, '0')}`;

      return await tx.order.create({
        data: {
          companyId: user.companyId,
          customerId,
          orderNumber: orderNum,
          status: "SALE_ORDER",
          totalAmount,
          lines: {
            create: cart.map((item: any) => ({
              productId: item.id,
              companyId: user.companyId,
              quantity: item.qty,
              unitPrice: item.price,
              subtotal: item.price * item.qty
            }))
          }
        },
        include: { customer: true, lines: true }
      });
    });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUserContext(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, status, bookingNumber, deliveryCharges, paymentStatus } = await request.json();
    
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { 
          status, 
          bookingNumber: bookingNumber || null, 
          deliveryCharges: deliveryCharges ? parseFloat(deliveryCharges) : 0,
          paymentStatus: paymentStatus || "PENDING"
        },
        include: { lines: true }
      });

      if (status === "DISPATCHED" || status === "BOOKED") {
        const existingInvoice = await tx.salesInvoice.findFirst({
          where: { invoiceNo: `INV-${order.orderNumber}` }
        });

        if (!existingInvoice) {
          await tx.salesInvoice.create({
            data: {
              companyId: user.companyId,
              customerId: order.customerId,
              invoiceNo: `INV-${order.orderNumber}`,
              invoiceDate: new Date(),
              status: "DRAFT",
              subtotal: order.totalAmount,
              deliveryCharges: order.deliveryCharges,
              total: Number(order.totalAmount) + Number(order.deliveryCharges),
              notes: `Auto-generated from Order ${order.orderNumber}. Booking Ref: ${order.bookingNumber || 'N/A'}. Payment Status: ${order.paymentStatus}`,
              lines: {
                create: order.lines.map(line => ({
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  total: line.subtotal
                }))
              }
            }
          });
        }
      }
      return order;
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}