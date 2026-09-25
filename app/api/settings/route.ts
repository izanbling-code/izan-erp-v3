import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { DEFAULT_ERP_SETTINGS } from "@/app/types/erp-settings";
import fs from "fs";
import path from "path";

const FALLBACK_FILE = path.join(process.cwd(), "settings-data.json");

function readFallback() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"));
    }
  } catch (e) {}
  return DEFAULT_ERP_SETTINGS;
}

function writeFallback(data: any) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {}
}

export async function GET() {
  try {
    let settings = readFallback();
    // Attempt reading company model for currency & name sync
    try {
      const company = await prisma.company.findFirst();
      if (company) {
        settings.general.companyName = company.name || settings.general.companyName;
        settings.general.currency = company.currency || settings.general.currency;
        settings.general.ntn = company.ntn || settings.general.ntn;
        settings.general.country = company.country || settings.general.country;
      }
    } catch (e) {}

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ ok: true, settings: DEFAULT_ERP_SETTINGS });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = readFallback();
    const updated = {
      general: { ...current.general, ...(body.general || {}) },
      purchases: { ...current.purchases, ...(body.purchases || {}) },
      sales: { ...current.sales, ...(body.sales || {}) },
      inventory: { ...current.inventory, ...(body.inventory || {}) },
    };

    writeFallback(updated);

    // Sync with company database table
    try {
      const comp = await prisma.company.findFirst();
      const compData = {
        name: updated.general.companyName,
        currency: updated.general.currency,
        ntn: updated.general.ntn,
        country: updated.general.country,
      };
      if (comp) {
        await prisma.company.update({ where: { id: comp.id }, data: compData });
      } else {
        await prisma.company.create({ data: compData });
      }
    } catch (e) {}

    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Failed to save settings" }, { status: 500 });
  }
}
