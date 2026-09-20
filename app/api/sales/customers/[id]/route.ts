import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        salesInvoices: {
          orderBy: {
            invoiceDate: "desc",
          },
          take: 20,
        },
        payments: {
          orderBy: {
            paymentDate: "desc",
          },
          take: 20,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("GET customer failed:", error);

    return NextResponse.json(
      { error: "Failed to load customer" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        taxNumber: body.taxNumber?.trim() || null,
        openingBalance: body.openingBalance ?? 0,
        creditLimit: body.creditLimit ?? 0,
        status: body.status ?? "ACTIVE",
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("PUT customer failed:", error);

    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        status: "INACTIVE",
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("DELETE customer failed:", error);

    return NextResponse.json(
      { error: "Failed to deactivate customer" },
      { status: 500 }
    );
  }
}
