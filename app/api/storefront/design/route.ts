 // app/api/storefront/design/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authenticate } from "@/app/lib/auth";

/** Recursively merges `patch` into `base`, returning a new object. */
function deepMerge<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  if (Array.isArray(patch)) return patch as unknown as T;
  if (typeof patch !== "object" || patch === null) return patch as unknown as T;
  const out: Record<string, any> = { ...(base as any) };
  for (const key of Object.keys(patch)) {
    const bv = (base as any)?.[key];
    const pv = (patch as any)[key];
    if (pv && typeof pv === "object" && !Array.isArray(pv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      out[key] = deepMerge(bv, pv);
    } else {
      out[key] = pv;
    }
  }
  return out as T;
}

export async function GET() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: true, storefront: null });

    const settings = await prisma.companySettings.findUnique({
      where: { companyId: company.id },
      select: { storefront: true },
    });
    return NextResponse.json({ ok: true, storefront: settings?.storefront ?? null });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { patch } = body as { patch: Record<string, any> };
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid patch payload" }, { status: 400 });
    }

    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ ok: false, error: "Company not found" }, { status: 404 });

    let current = await prisma.companySettings.findUnique({ where: { companyId: company.id } });
    if (!current) {
      current = await prisma.companySettings.create({
        data: {
          companyId: company.id,
          general: {}, appearance: {}, sales: {}, purchases: {}, inventory: {}, numbering: {}, accounting: {},
          storefront: {},
        },
      });
    }

    // Deep-merge so existing pages/canvasElements/other templates are never wiped
    const existing = (current.storefront as Record<string, any>) || {};
    const merged = deepMerge(existing, patch);

    await prisma.companySettings.update({
      where: { companyId: company.id },
      data: { storefront: merged },
    });

    return NextResponse.json({ ok: true, storefront: merged });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}