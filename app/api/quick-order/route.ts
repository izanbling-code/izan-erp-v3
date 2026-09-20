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
    const products = await prisma.product.findMany({
      where: { companyId: user.companyId, isActive: true },
      include: { stock: true, category: true }
    });

    const mapped = products.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      // Fallback to cost if sales price isn't set yet
      price: Number(p.salePrice || p.salesPrice || p.costPrice || 0),
      stock: p.stock.reduce((sum, s) => sum + Number(s.quantity), 0),
      category: p.category?.name || "All"
    }));

    return NextResponse.json({ success: true, products: mapped });
  } catch (error) {
    console.error("GET Products Error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserContext(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { cart, paymentMethod, taxAmount, grandTotal } = await request.json();
    
    if (!cart || cart.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Wrap the checkout process in an ACID-compliant transaction
    const order = await prisma.$transaction(async (tx) => {
      
      // 1. Ensure a "Walk-in Customer" exists for POS
      let walkIn = await tx.customer.findFirst({ 
        where: { companyId: user.companyId, name: "Walk-in Customer" } 
      });
      if (!walkIn) {
        walkIn = await tx.customer.create({ 
          data: { companyId: user.companyId, name: "Walk-in Customer" } 
        });
      }

      // 2. Create the Order
      const newOrder = await tx.order.create({
        data: {
          companyId: user.companyId,
          customerId: walkIn.id,
          orderNumber: `POS-${Date.now().toString().slice(-6)}`,
          status: "DISPATCHED",
          paymentStatus: "PAID",
          totalAmount: grandTotal,
          lines: {
            create: cart.map((item: any) => ({
              productId: item.id,
              companyId: user.companyId,
              quantity: item.qty,
              unitPrice: item.price,
              subtotal: item.price * item.qty
            }))
          }
        }
      });

      // 3. Deduct Stock for each item
      for (const item of cart) {
        // Find the first warehouse with stock for this product
        const stockRecord = await tx.stock.findFirst({
          where: { productId: item.id, quantity: { gte: item.qty } }
        });

        if (stockRecord) {
          await tx.stock.update({
            where: { id: stockRecord.id },
            data: { quantity: { decrement: item.qty } }
          });
        }
      }

      // 4. Log the Payment
      await tx.payment.create({
        data: {
          companyId: user.companyId,
          customerId: walkIn.id,
          paymentNo: `PAY-${Date.now().toString().slice(-6)}`,
          paymentDate: new Date(),
          type: "RECEIPT",
          method: paymentMethod,
          amount: grandTotal,
          description: `POS Checkout - ${newOrder.orderNumber}`
        }
      });

      return newOrder;
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Transaction failed" }, { status: 500 });
  }
}