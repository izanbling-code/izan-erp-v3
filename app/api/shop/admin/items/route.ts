import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ success: true, items: [] });

    // For now we map products directly from the ERP product table or a dedicated flag
    const products = await prisma.product.findMany({
      where: { companyId: company.id, isActive: true }
    });

    const items = products.map(p => ({
      id: p.id,
      name: p.name,
      price: Number(p.salePrice || p.salesPrice || p.costPrice || 0),
      category: "General",
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
      stock: 10
    }));

    return NextResponse.json({ success: true, items });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, price, category, image, stock } = await request.json();
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "No company found" }, { status: 400 });

    // Create item as a live ERP product
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        name,
        sku: `WEB-${Date.now().toString().slice(-5)}`,
        salePrice: price,
        salesPrice: price,
        costPrice: price,
        isActive: true
      }
    });

    return NextResponse.json({ success: true, product });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}