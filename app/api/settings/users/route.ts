import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { scryptSync, randomBytes } from "crypto";

// Authenticate via the V3 ib_session cookie
async function getUserContext(request: NextRequest) {
  const sessionCookie = request.cookies.get("ib_session")?.value;
  if (!sessionCookie) return null;
  try {
    const payload = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    return await prisma.user.findUnique({ where: { id: payload.userId } });
  } catch (e) {
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
    
    // Map Prisma schema to what the UI expects
    const formattedUsers = users.map(u => ({
      ...u,
      status: u.isActive ? "ACTIVE" : "INACTIVE"
    }));

    return NextResponse.json({ ok: true, users: formattedUsers });
  } catch (error) {
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

  // Hash the password
  const salt = randomBytes(16).toString("hex");
  const derivedHash = scryptSync(password, salt, 64).toString("hex");
  const hashedPassword = `${salt}:${derivedHash}`;

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: status === "ACTIVE",
        companyId: admin.companyId,
        roleId: roleId || null
      }
    });
    return NextResponse.json({ ok: true, message: "User created successfully." });
  } catch (error) {
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
      roleId: roleId || null
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
  } catch (error) {
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
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to delete user." }, { status: 500 });
  }
}