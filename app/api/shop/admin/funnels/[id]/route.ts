import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const quiz = await prisma.storefrontQuiz.findUnique({
      where: { id: params.id },
      include: { 
        nodes: { 
          include: { choices: true },
          orderBy: { createdAt: 'asc' } 
        } 
      }
    });
    return NextResponse.json(quiz);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch funnel" }, { status: 500 });
  }
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await req.json();
    
    if (body.action === "ADD_NODE") {
      const newNode = await prisma.quizNode.create({
        data: { quizId: params.id, questionText: "New Question" }
      });
      return NextResponse.json({ success: true, node: newNode });
    }
    
    if (body.action === "ADD_CHOICE") {
      const newChoice = await prisma.quizChoice.create({
        data: { nodeId: body.nodeId, text: "New Option" }
      });
      return NextResponse.json({ success: true, choice: newChoice });
    }

    // NEW: Save Question Text
    if (body.action === "UPDATE_NODE") {
      const updated = await prisma.quizNode.update({
        where: { id: body.nodeId },
        data: { questionText: body.questionText }
      });
      return NextResponse.json({ success: true, node: updated });
    }

    // NEW: Save Choice Text & Routing Logic
    if (body.action === "UPDATE_CHOICE") {
      const updated = await prisma.quizChoice.update({
        where: { id: body.choiceId },
        data: { 
          text: body.text,
          nextNodeId: body.nextNodeId !== undefined ? body.nextNodeId : undefined,
          resultUrl: body.resultUrl !== undefined ? body.resultUrl : undefined
        }
      });
      return NextResponse.json({ success: true, choice: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}