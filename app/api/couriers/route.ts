import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

// SAFETY NET: Ensure a company profile exists before linking couriers
async function getCompany() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({ data: { name: 'Default Company' } });
  }
  return company;
}

export async function GET() {
  try {
    const company = await getCompany();
    
    // FETCH COURIERS + THEIR LINKED INVOICES
    const couriers = await prisma.courier.findMany({
      where: { companyId: company.id },
      include: {
        invoices: {
          include: {
            customer: true // Includes customer details so the ledger can display "Billed To" info
          },
          orderBy: {
            invoiceDate: 'desc'
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, couriers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company = await getCompany();
    const courier = await prisma.courier.create({
      data: {
        name: body.name,
        contactName: body.contactName,
        phone: body.phone,
        trackingUrl: body.trackingUrl,
        isActive: body.isActive ?? true,
        companyId: company.id
      }
    });
    return NextResponse.json({ success: true, courier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    const courier = await prisma.courier.update({ where: { id }, data });
    return NextResponse.json({ success: true, courier });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    await prisma.courier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}