import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({ where: { type: "GOODS" }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // SAFEGUARD: Auto-create the master company if the database is 100% empty
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: { name: "Izan Bling", country: "Pakistan", currency: "PKR" }
      });
    }
    
    const product = await prisma.product.create({
      data: {
        companyId: company.id,
        name: body.name,
        sku: body.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        salePrice: Number(body.price),
        imageUrl: body.imageUrl,
        description: body.description,
        type: "GOODS",
        isActive: true
      }
    });
    return NextResponse.json(product);
  } catch (error: any) {
    console.error("Product Error:", error);
    return NextResponse.json({ error: error.message || "Database failed to save product." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
