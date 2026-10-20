import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst({ include: { companySettings: true } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json({ company });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const existingSettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    const currentStorefront = (existingSettings?.storefront as any) || { pages: {} };

    // Deep merge the specific page being saved
    const updatedStorefront = {
      ...currentStorefront,
      ...body.storefront,
      pages: {
        ...(currentStorefront.pages || {}),
        ...(body.storefront?.pages || {})
      }
    };

    const savedSettings = await prisma.companySettings.upsert({
      where: { companyId: company.id },
      update: { storefront: updatedStorefront },
      create: { companyId: company.id, storefront: updatedStorefront }
    });

    return NextResponse.json({ success: true, companySettings: savedSettings });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}