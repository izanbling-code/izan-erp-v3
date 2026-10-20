import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { scryptSync, randomBytes } from "crypto";

// Authenticate via the V3 ib_session cookie
async function getUserContext(request: NextRequest) {
  const sessionCookie = request.cookies.get("ib_session")?.value;
  if (!sessionCookie) {
    console.log("❌ [API Users] No ib_session cookie found.");
    return null;
  }
  
  try {
    // 1. Decode any URL encoding (Next.js sometimes encodes cookies)
    const decodedCookie = decodeURIComponent(sessionCookie);
    
    // 2. Convert from Base64 to String
    const jsonStr = Buffer.from(decodedCookie, 'base64').toString('utf-8');
    
    // 3. 🔥 THE FIX: Safely extract only the JSON object (ignores trailing % or padding characters)
    const cleanJsonStr = jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1);
    
    const payload = JSON.parse(cleanJsonStr);
    
    if (!payload || !payload.userId) {
      console.log("❌ [API Users] Payload missing userId:", payload);
      return null;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    
    if (!user) {
      console.log("❌ [API Users] User in cookie not found in database:", payload.userId);
      return null;
    }
    
    return user;
  } catch (e) {
    console.log("❌ [API Users] Error parsing session cookie:", e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await getUserContext(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized access" }, { status: 401 });

  try {
    const users = await prisma.user.findMany({
      where: { companyId: admin.companyId },
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.isActive ? "ACTIVE" : "INACTIVE",
      isActive: u.isActive,
      roleId: u.roleId,
      role: u.role ? { id: u.role.id, name: u.role.name, description: null } : null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, users: formattedUsers });
  } catch (error: any) {
    console.error("❌ [API Users] Prisma GET Error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getUserContext(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized access" }, { status: 401 });

  const { name, email, password, roleId, status } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const salt = randomBytes(16).toString("hex");
  const derivedHash = scryptSync(password, salt, 64).toString("hex");
  const hashedPassword = `${salt}:${derivedHash}`;

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: status === "ACTIVE",
        companyId: admin.companyId,
        roleId: roleId && roleId.trim() !== "" ? roleId : null 
      }
    });
    return NextResponse.json({ ok: true, message: "User created successfully." });
  } catch (error: any) {
    console.error("❌ [API Users] Prisma POST Error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to create user. Email may already exist." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await getUserContext(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized access" }, { status: 401 });

  const { id, name, email, password, roleId, status } = await request.json();

  try {
    const updateData: any = {
      name,
      email,
      isActive: status === "ACTIVE",
      roleId: roleId && roleId.trim() !== "" ? roleId : null
    };

    if (password) {
      const salt = randomBytes(16).toString("hex");
      const derivedHash = scryptSync(password, salt, 64).toString("hex");
      updateData.password = `${salt}:${derivedHash}`;
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    });
    return NextResponse.json({ ok: true, message: "User updated successfully." });
  } catch (error: any) {
    console.error("❌ [API Users] Prisma PUT Error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getUserContext(request);
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized access" }, { status: 401 });

  const { id } = await request.json();

  if (id === admin.id) {
    return NextResponse.json({ ok: false, error: "You cannot delete your own admin account." }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true, message: "User deleted successfully." });
  } catch (error: any) {
    console.error("❌ [API Users] Prisma DELETE Error:", error.message);
    return NextResponse.json({ ok: false, error: "Failed to delete user." }, { status: 500 });
  }
}