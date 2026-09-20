import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 400 });

    // Handle Category creation if needed
    let categoryId = null;
    if (body.category) {
      const cat = await prisma.category.upsert({
        where: { companyId_name: { companyId: company.id, name: body.category.trim() } },
        update: {},
        create: { companyId: company.id, name: body.category.trim() }
      });
      categoryId = cat.id;
    }

    // Grab default accounts
    const companySettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    const accountingDefaults = (companySettings?.accounting as any) || {};

    const newProduct = await prisma.product.create({
      data: {
        companyId: company.id,
        name: body.name,
        sku: body.sku,
        categoryId,
        costPrice: Number(body.costPrice) || 0,
        salePrice: Number(body.salePrice) || 0,
        useDefaultAccounts: true, // Automatically link the defaults!
        salesAccountId: accountingDefaults.defaultSalesAccountId || null,
        inventoryAccountId: accountingDefaults.defaultInventoryAccountId || null,
        cogsAccountId: accountingDefaults.defaultCogsAccountId || null,
      }
    });

    return NextResponse.json({ ok: true, product: newProduct });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: "A product with this SKU already exists." }, { status: 400 });
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
