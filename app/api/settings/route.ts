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
    
    try {
      const company = await prisma.company.findFirst();
      if (company) {
        settings.general.companyName = company.name || settings.general.companyName;
        settings.general.legalName = company.legalName || settings.general.legalName;
        settings.general.ntn = company.ntn || settings.general.ntn;
        settings.general.email = company.email || settings.general.email;
        settings.general.phone = company.phone || settings.general.phone;
        settings.general.address = company.address || settings.general.address;
        settings.general.country = company.country || settings.general.country;
        settings.general.currency = company.currency || settings.general.currency;
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
      numbering: { ...current.numbering, ...(body.numbering || {}) },
      appearance: { ...current.appearance, ...(body.appearance || {}) },
    };

    writeFallback(updated);

    try {
      const comp = await prisma.company.findFirst();
      const compData = {
        name: updated.general.companyName,
        legalName: updated.general.legalName,
        ntn: updated.general.ntn,
        email: updated.general.email,
        phone: updated.general.phone,
        address: updated.general.address,
        country: updated.general.country,
        currency: updated.general.currency,
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
