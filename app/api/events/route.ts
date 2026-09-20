import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const event = await prisma.eventPlanner.findUnique({
        where: { id, companyId: company.id },
        include: { items: true, expenses: true, sales: { include: { items: true }, orderBy: { createdAt: 'desc' } } },
      });
      return NextResponse.json({ ok: true, event });
    }

    const events = await prisma.eventPlanner.findMany({
      where: { companyId: company.id },
      orderBy: { eventDate: "desc" },
      include: { items: true, expenses: true, sales: { include: { items: true } } }
    });
    
    return NextResponse.json({ ok: true, events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load events" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    if (body.action === "CREATE_EVENT") {
      const event = await prisma.eventPlanner.create({
        data: { companyId: company.id, name: body.name, location: body.location || null, notes: body.notes || null, eventDate: new Date(body.eventDate) },
      });
      return NextResponse.json({ ok: true, event });
    }

    if (body.action === "ADD_ITEM") {
      const item = await prisma.eventItem.create({
        data: { eventId: body.eventId, name: body.name, quantity: Number(body.quantity), unitCost: Number(body.unitCost) },
      });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "ADD_EXPENSE") {
      const expense = await prisma.eventExpense.create({
        data: { eventId: body.eventId, description: body.description, amount: Number(body.amount) },
      });
      return NextResponse.json({ ok: true, expense });
    }

    if (body.action === "RECORD_SALE") {
      const sale = await prisma.eventSale.create({
        data: {
          eventId: body.eventId,
          customerName: body.customerName || null,
          customerPhone: body.customerPhone || null,
          paymentMethod: body.paymentMethod || "CASH",
          totalAmount: Number(body.totalAmount),
          items: {
            create: body.cart.map((c: any) => ({
              itemId: c.itemId,
              quantity: Number(c.quantity),
              unitPrice: Number(c.unitPrice),
              totalPrice: Number(c.quantity) * Number(c.unitPrice),
            }))
          }
        }
      });
      return NextResponse.json({ ok: true, sale });
    }

            if (body.action === "IMPORT_INVENTORY") {
      const sourceEvent = await prisma.eventPlanner.findUnique({
        where: { id: body.sourceEventId },
        include: { items: true, sales: { include: { items: true } } }
      });

      if (!sourceEvent || sourceEvent.items.length === 0) {
        return NextResponse.json({ error: "No items found in the selected past event." }, { status: 400 });
      }

      const newItemsData = [];
      
      for (const item of sourceEvent.items) {
        let soldQty = 0;
        // Calculate exactly how many of this item were sold
        for (const sale of sourceEvent.sales) {
          for (const saleItem of sale.items) {
            if (saleItem.itemId === item.id) {
              soldQty += saleItem.quantity;
            }
          }
        }
        
        const remainingQty = item.quantity - soldQty;
        
        // ONLY import items that actually have remaining stock
        if (remainingQty > 0) {
          newItemsData.push({
            eventId: body.targetEventId,
            name: item.name,
            quantity: remainingQty,
            unitCost: item.unitCost
          });
        }
      }

      if (newItemsData.length === 0) {
        return NextResponse.json({ error: "All items from this event were sold out! No remaining stock to import." }, { status: 400 });
      }

      await prisma.eventItem.createMany({ data: newItemsData });
      return NextResponse.json({ ok: true, importedCount: newItemsData.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "DELETE_EVENT") await prisma.eventPlanner.delete({ where: { id: body.id } });
    else if (body.action === "DELETE_ITEM") await prisma.eventItem.delete({ where: { id: body.id } });
    else if (body.action === "DELETE_EXPENSE") await prisma.eventExpense.delete({ where: { id: body.id } });
    else if (body.action === "DELETE_SALE") await prisma.eventSale.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete" }, { status: 500 });
  }
}