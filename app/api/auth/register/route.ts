import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import crypto, { scryptSync } from "crypto";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists." }, { status: 400 });
    }

    // Hash the password (Using the exact same method as your login route)
    const salt = crypto.randomBytes(16).toString("hex");
    const derivedHash = scryptSync(password, salt, 64).toString("hex");
    const hashedPassword = `${salt}:${derivedHash}`;

    // Get default company and role
    let company = await prisma.company.findFirst();
    let defaultRole = await prisma.role.findFirst({ where: { name: "Staff" } });
    
    if (!defaultRole && company) {
      defaultRole = await prisma.role.create({
        data: { name: "Staff", companyId: company.id, permissions: [] }
      });
    }

    // Create the user with isActive: false
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: false, // <-- BLOCKED UNTIL APPROVED
        companyId: company!.id,
        roleId: defaultRole!.id,
      }
    });

    return NextResponse.json({ success: true, message: "Registration pending approval." });
  } catch (error) {
    return NextResponse.json({ error: "Failed to register." }, { status: 500 });
  }
}