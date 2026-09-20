import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const SETTINGS_KEYS = [
  "general",
  "sales",
  "purchases",
  "inventory",
  "accounting",
  "tax",
  "numbering",
  "security",
  "notifications",
  "appearance",
  "dashboard",
  "modules",
  "templates",
] as const;

type SettingsKey = (typeof SETTINGS_KEYS)[number];

function isSettingsKey(value: unknown): value is SettingsKey {
  return (
    typeof value === "string" &&
    SETTINGS_KEYS.includes(value as SettingsKey)
  );
}

async function getCompany() {
  return prisma.company.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function GET() {
  try {
    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    let settings = await prisma.companySettings.findUnique({
      where: {
        companyId: company.id,
      },
    });

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyId: company.id,
        },
      });
    }

    const accounts = await prisma.account.findMany({
      where: {
        companyId: company.id,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        systemCode: true,
      },
      orderBy: {
        code: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      company,
      settings,
      accounts,
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load settings.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const company = await getCompany();

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet.",
        },
        { status: 400 }
      );
    }

    const key = body.key;

    if (!isSettingsKey(key)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid settings section.",
        },
        { status: 400 }
      );
    }

    const value =
      body.value !== null &&
      typeof body.value === "object"
        ? body.value
        : {};

    const settings = await prisma.companySettings.upsert({
      where: {
        companyId: company.id,
      },
      create: {
        companyId: company.id,
        [key]: value,
      },
      update: {
        [key]: value,
      },
    });

    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error) {
    console.error("PUT /api/settings error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to save settings.",
      },
      { status: 500 }
    );
  }
}

