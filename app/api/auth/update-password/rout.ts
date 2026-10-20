import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { scryptSync, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Hash the new password exactly like your login route does
    const salt = randomBytes(16).toString("hex");
    const derivedHash = scryptSync(password, salt, 64).toString("hex");
    const hashedPassword = `${salt}:${derivedHash}`;

    // Update the user in the database
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }
}