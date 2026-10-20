import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const quizzes = await prisma.storefrontQuiz.findMany({
      where: { companyId: company.id },
      include: {
        nodes: {
          include: { choices: true, targetedBy: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(quizzes);
  } catch (error: any) {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const newQuiz = await prisma.storefrontQuiz.create({
      data: {
        companyId: company.id,
        title: body.title || "New Guided Journey",
        description: body.description || "",
        isWelcomePopup: body.isWelcomePopup || false,
        nodes: {
          create: {
            questionText: "What are you looking for today?",
            isStartingNode: true
          }
        }
      }
    });

    return NextResponse.json({ success: true, quiz: newQuiz });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to create funnel" }, { status: 500 });
  }
}
