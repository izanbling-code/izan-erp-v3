import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const message = formData.get("message") as string;

    if (!process.env.GMAIL_APP_PASSWORD) {
        return NextResponse.redirect(new URL("/shop?contact=error", req.url));
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "izanbling@gmail.com",
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: "izanbling@gmail.com",
      to: "izanbling@gmail.com",
      replyTo: email,
      subject: `New Message from ${name} (Izan Bling Shop)`,
      text: message,
    });

    return NextResponse.redirect(new URL("/shop?contact=success", req.url));
  } catch (error) {
    console.error("Contact Error:", error);
    return NextResponse.redirect(new URL("/shop?contact=error", req.url));
  }
}
