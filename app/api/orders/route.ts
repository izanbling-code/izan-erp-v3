import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ success: false, error: "No master company found." });

    const orders = await prisma.order.findMany({
      where: { companyId: company.id },
      include: {
        customer: true,
        lines: {
          include: {
            product: {
              include: {
                stockBatches: {
                  where: { quantity: { gt: 0 } },
                  include: { batch: true },
                  orderBy: { batch: { createdAt: 'asc' } }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const customers = await prisma.customer.findMany({ where: { companyId: company.id } });
    const products = await prisma.product.findMany({ where: { companyId: company.id, type: "GOODS" } });

    return NextResponse.json({ success: true, orders, customers, products, company });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) throw new Error("No company found");

    const orderCount = await prisma.order.count({ where: { companyId: company.id } });
    const orderNumber = `ORD-${String(orderCount + 1).padStart(5, '0')}`;

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        customerId: body.customerId,
        orderNumber,
        status: "SALE_ORDER",
        totalAmount: Number(body.totalAmount),
        lines: {
          create: body.cart.map((item: any) => ({
            companyId: company.id,
            productId: item.id,
            quantity: item.qty,
            unitPrice: Number(item.price),
            subtotal: Number(item.price) * item.qty
          }))
        }
      }
    });
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();

    // ACTION 1: Mini-Invoice Editor (Add/Remove items before generation)
    if (body.action === "UPDATE_LINES") {
      await prisma.orderLine.deleteMany({ where: { orderId: body.id } });
      const updatedOrder = await prisma.order.update({
        where: { id: body.id },
        data: {
          totalAmount: body.totalAmount,
          lines: {
            create: body.lines.map((l: any) => ({
              companyId: company!.id,
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal
            }))
          }
        }
      });
      return NextResponse.json({ success: true, order: updatedOrder });
    }

    // ACTION 2: Status Updates & Dispatching
    const updated = await prisma.order.update({
      where: { id: body.id },
      data: {
        status: body.status,
        bookingNumber: body.bookingNumber,
        deliveryCharges: Number(body.deliveryCharges),
        paymentStatus: body.paymentStatus
      }
    });

    // If Dispatched, find the Draft Invoice and explicitly update its totals and formatted tracking data
    if (body.status === "DISPATCHED") {
      const invoice = await prisma.salesInvoice.findFirst({
        where: { companyId: company!.id, notes: { contains: updated.orderNumber } }
      });
      
      if (invoice) {
        await prisma.salesInvoice.update({
          where: { id: invoice.id },
          data: {
            deliveryCharges: Number(body.deliveryCharges),
            total: Number(invoice.subtotal) + Number(body.deliveryCharges),
            // Strictly formatted so your future web orders list can parse this easily. Prepending "Web Order | " ensures it routes to the correct tab.
            notes: `Web Order | Order: ${updated.orderNumber} | Courier: ${body.courierName} | Tracking: ${body.trackingNumber} | Payment: ${body.paymentStatus}`
          }
        });
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing ID" });
    
    await prisma.order.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
