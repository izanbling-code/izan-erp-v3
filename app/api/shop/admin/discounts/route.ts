import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const company = await prisma.company.findFirst();
  const discounts = await prisma.discount.findMany({ where: { companyId: company?.id } });
  return NextResponse.json({ ok: true, data: discounts });
}

export async function POST(req: Request) {
  const { code, type, value } = await req.json();
  const company = await prisma.company.findFirst();
  const discount = await prisma.discount.create({
    data: { companyId: company!.id, code, type, value: Number(value) }
  });
  return NextResponse.json({ ok: true, data: discount });
}