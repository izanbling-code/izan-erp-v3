import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const result = value.trim();

  return result.length > 0 ? result : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
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

    return NextResponse.json({
      ok: true,
      company,
    });
  } catch (error) {
    console.error("GET /api/settings/company error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load company information.",
      },
      { status: 500 }
    );
  }
}

async function saveCompany(request: NextRequest) {
  try {
    const body = await request.json();

    const name = clean(body.name);

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Company name is required.",
        },
        { status: 400 }
      );
    }

    const data = {
      name,
      legalName: clean(body.legalName),
      ntn: clean(body.ntn),
      email: clean(body.email),
      phone: clean(body.phone),
      address: clean(body.address),
      city: clean(body.city),
      country: clean(body.country) ?? "Pakistan",
      currency: clean(body.currency) ?? "PKR",
    };

    const existing = await getCompany();

    let company;

    if (existing) {
      company = await prisma.company.update({
        where: {
          id: existing.id,
        },
        data,
      });
    } else {
      company = await prisma.company.create({
        data,
      });
    }

    return NextResponse.json({
      ok: true,
      company,
      message: "Company information saved successfully.",
    });
  } catch (error) {
    console.error("SAVE /api/settings/company error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return saveCompany(request);
}

export async function PUT(request: NextRequest) {
  return saveCompany(request);
}
