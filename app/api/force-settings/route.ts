import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "No company found" });

    // Fetch the exact accounts from your screenshot using their unique codes
    const courierCollection = await prisma.account.findFirst({ where: { companyId: company.id, code: "3001" } });
    const courierPayable = await prisma.account.findFirst({ where: { companyId: company.id, code: "3004" } });
    const deliveryIncome = await prisma.account.findFirst({ where: { companyId: company.id, code: "30006" } });
    const deliveryExpense = await prisma.account.findFirst({ where: { companyId: company.id, code: "3003" } });

    if (!courierCollection || !courierPayable || !deliveryIncome || !deliveryExpense) {
       return NextResponse.json({ error: "Could not find one or more accounts. Check if codes 3001, 3004, 30006, 3003 exist." });
    }

    let settings = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    
    let salesSettings = (settings?.sales as any) || {};
    
    // Force the exact IDs directly into the JSON configuration
    salesSettings.courierCollectionAccount = courierCollection.id;
    salesSettings.courierPayableAccount = courierPayable.id;
    salesSettings.deliveryIncomeAccount = deliveryIncome.id;
    salesSettings.deliveryExpenseAccount = deliveryExpense.id;

    await prisma.companySettings.update({
      where: { companyId: company.id },
      data: { sales: salesSettings }
    });

    return NextResponse.json({ success: true, message: "Settings successfully forced into the database!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
