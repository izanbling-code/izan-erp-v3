import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await req.json();
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: true }
  });
  return NextResponse.json({ ok: true });
}