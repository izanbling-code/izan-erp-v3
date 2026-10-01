import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authenticate } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ ok: true, settings: {} });
    }

    const settings = await prisma.companySettings.findUnique({
      where: { companyId: company.id }
    });

    return NextResponse.json({ 
      ok: true, 
      settings: settings || {} 
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { category, data } = body;

    if (!category || !data) {
      return NextResponse.json({ ok: false, error: "Category and data are required" }, { status: 400 });
    }

    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });

    let currentSettings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    if (!currentSettings) {
      currentSettings = await prisma.companySettings.create({ 
        data: { companyId: company.id, general: {}, appearance: {}, sales: {}, purchases: {}, inventory: {}, numbering: {}, accounting: {} } 
      });
    }

    // Perform a deep merge to ensure new fields like courierDepositAccount are saved properly
    const existingCategoryData = (currentSettings as any)[category] || {};
    const mergedData = { ...existingCategoryData, ...data };

    await prisma.companySettings.update({
      where: { companyId: company.id },
      data: { [category]: mergedData }
    });

    return NextResponse.json({ ok: true, message: "Settings updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}