import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ success: false, error: "No master company found." });

    // 1. Fetch Orders with nested Stock Batches for the Allocation Matrix
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

    // 2. Fetch data for the manual "Create Order" tab
    const customers = await prisma.customer.findMany({ where: { companyId: company.id } });
    const products = await prisma.product.findMany({ where: { companyId: company.id, type: "GOODS" } });

    return NextResponse.json({ success: true, orders, customers, products, company });
  } catch (error: any) {
    console.error("GET Orders Error:", error);
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
    const updated = await prisma.order.update({
      where: { id: body.id },
      data: {
        status: body.status,
        bookingNumber: body.bookingNumber,
        deliveryCharges: Number(body.deliveryCharges),
        paymentStatus: body.paymentStatus
      }
    });
    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
