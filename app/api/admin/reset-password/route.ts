import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/app/lib/prisma";

/*
 * ============================================================
 * RESET PASSWORD SETTINGS
 * ============================================================
 *
 * Stores a hashed password (scrypt) inside
 * CompanySettings.security, under keys resetPasswordHash /
 * resetPasswordSalt. This gates the "Reset All Data" button
 * in /admin/reset.
 *
 * IMPORTANT HONESTY NOTE:
 * This is a speed bump against accidental clicks, not real
 * access control. The app has no login/session system yet, so
 * every API route (including this one and /api/admin/reset-data)
 * is reachable by anyone who can reach your server. Once real
 * authentication exists, this should be replaced by an actual
 * permission check instead of a shared password.
 */

type SecuritySettings = {
  resetPasswordHash?: string;
  resetPasswordSalt?: string;
  [key: string]: unknown;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string) {
  try {
    const candidate = scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");

    if (candidate.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

async function getCompany() {
  return prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

async function getOrCreateSettings(companyId: string) {
  const existing = await prisma.companySettings.findUnique({
    where: { companyId },
  });

  if (existing) return existing;

  return prisma.companySettings.create({
    data: { companyId },
  });
}

/* ============================================================
   GET - is a reset password configured yet?
   ============================================================ */

export async function GET() {
  try {
    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        { ok: false, error: "No company has been configured yet." },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings(company.id);
    const security = (settings.security as SecuritySettings) ?? {};

    return NextResponse.json({
      ok: true,
      configured: Boolean(security.resetPasswordHash),
    });
  } catch (error) {
    console.error("GET /api/admin/reset-password error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to check reset password status." },
      { status: 500 }
    );
  }
}

/* ============================================================
   POST - set the password for the first time, or change it
   ============================================================ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newPassword = String(body.newPassword ?? "");
    const currentPassword =
      body.currentPassword !== undefined && body.currentPassword !== null
        ? String(body.currentPassword)
        : null;

    if (newPassword.length < 4) {
      return NextResponse.json(
        {
          ok: false,
          error: "New password must be at least 4 characters.",
        },
        { status: 400 }
      );
    }

    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        { ok: false, error: "No company has been configured yet." },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings(company.id);
    const security = (settings.security as SecuritySettings) ?? {};

    /*
     * If a password is already set, the current one must be
     * provided and correct before it can be changed.
     */
    if (security.resetPasswordHash && security.resetPasswordSalt) {
      if (!currentPassword) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "A reset password is already set. Enter the current password to change it.",
          },
          { status: 400 }
        );
      }

      const valid = verifyPassword(
        currentPassword,
        security.resetPasswordSalt,
        security.resetPasswordHash
      );

      if (!valid) {
        return NextResponse.json(
          { ok: false, error: "Current password is incorrect." },
          { status: 401 }
        );
      }
    }

    const { salt, hash } = hashPassword(newPassword);

    await prisma.companySettings.update({
      where: { companyId: company.id },
      data: {
        security: {
          ...security,
          resetPasswordHash: hash,
          resetPasswordSalt: salt,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/admin/reset-password error:", error);

    return NextResponse.json(
      { ok: false, error: "Failed to save reset password." },
      { status: 500 }
    );
  }
}