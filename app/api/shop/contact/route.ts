import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Here you can integrate an email service or save to database later
    console.log("Contact Form Submission:", body);
    return NextResponse.json({ success: true, message: "Message received!" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit message" }, { status: 500 });
  }
}
