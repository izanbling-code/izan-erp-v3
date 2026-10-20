import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) return NextResponse.json({ ok: false, error: "No company configured" }, { status: 400 });

    const [products, categories, brands, units] = await Promise.all([
      prisma.product.findMany({ 
        where: { companyId: company.id }, 
        select: { id: true, name: true, categoryId: true, brandId: true, unitId: true } 
      }),
      prisma.category.findMany({ where: { companyId: company.id }, select: { id: true, name: true } }),
      prisma.brand.findMany({ where: { companyId: company.id }, select: { id: true, name: true } }),
      prisma.unit.findMany({ where: { companyId: company.id }, select: { id: true, name: true } })
    ]);

    return NextResponse.json({ ok: true, products, categories, brands, units });
  } catch (error) {
    console.error("Master Data Load Error:", error);
    return NextResponse.json({ ok: false, error: "Failed to load master data" }, { status: 500 });
  }
}