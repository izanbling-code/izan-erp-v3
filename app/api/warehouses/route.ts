import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      ok: true,
      warehouses,
    });
  } catch (error) {
    console.error("GET /api/warehouses error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load warehouses",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Warehouse name is required",
        },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          error: "Warehouse code is required",
        },
        { status: 400 }
      );
    }

    /*
     * Temporary single-company setup.
     *
     * We will replace this with authenticated/company context
     * once user/company authentication is implemented.
     */
    const company = await prisma.company.findFirst({
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!company) {
      return NextResponse.json(
        {
          ok: false,
          error: "No company has been configured yet",
        },
        { status: 400 }
      );
    }

    const existingWarehouse = await prisma.warehouse.findUnique({
      where: {
        companyId_code: {
          companyId: company.id,
          code,
        },
      },
    });

    if (existingWarehouse) {
      return NextResponse.json(
        {
          ok: false,
          error: "A warehouse with this code already exists",
        },
        { status: 409 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        name,
        code,
        address: body.address
          ? String(body.address).trim()
          : null,
        city: body.city
          ? String(body.city).trim()
          : null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        warehouse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/warehouses error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create warehouse",
      },
      { status: 500 }
    );
  }
}