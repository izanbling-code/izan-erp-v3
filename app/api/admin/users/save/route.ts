import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { scryptSync, randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, email, password, roleId, isActive } = body;

    let hashedPassword = undefined;
    if (password) {
      const salt = randomBytes(16).toString("hex");
      const derivedHash = scryptSync(password, salt, 64).toString("hex");
      hashedPassword = `${salt}:${derivedHash}`;
    }

    if (id) {
      // ==========================================
      // UPDATE EXISTING USER
      // ==========================================
      const updateData: any = { name, email, roleId, isActive };
      if (hashedPassword) updateData.password = hashedPassword;

      await prisma.user.update({
        where: { id },
        data: updateData,
      });
      
      return NextResponse.json({ ok: true, message: "User updated" });
    } else {
      // ==========================================
      // CREATE NEW USER
      // ==========================================
      
      // ✅ FIXED: Prisma returns the object directly, not wrapped in { data }
      const company = await prisma.company.findFirst();
      
      if (!company) {
        return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });
      }

      await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword!,
          roleId,
          isActive,
          companyId: company.id, // ✅ Now company is correctly defined
        },
      });
      
      return NextResponse.json({ ok: true, message: "User created" });
    }
  } catch (error: any) {
    console.error("Save User Error:", error);
    // Check for unique constraint violation (email already exists)
    if (error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: "A user with this email already exists." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}