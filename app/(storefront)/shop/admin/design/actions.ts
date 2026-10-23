"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { zStorefront } from "./validation";
import type { StorefrontSettingsV2 } from "./types";

// 1. Save to Draft
export async function saveDraftAction(
  storefront: StorefrontSettingsV2
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = zStorefront.safeParse(storefront);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  const safePayload = JSON.parse(JSON.stringify(parsed.data));

  try {
    const company = await prisma.company.findFirst({ select: { id: true } });
    if (!company) return { ok: false, error: "No company found" };

    await prisma.companySettings.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, storefrontDraft: safePayload },
      update: { storefrontDraft: safePayload },
    });

    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to save draft" };
  }
}

// 2. Publish Draft to Live
export async function publishDesignAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const company = await prisma.company.findFirst({
      include: { companySettings: true },
    });
    
    if (!company || !company.companySettings?.storefrontDraft) {
      return { ok: false, error: "No draft found to publish" };
    }

    // Copy draft to live
    await prisma.companySettings.update({
      where: { companyId: company.id },
      data: { storefront: company.companySettings.storefrontDraft },
    });

    // Tell Next.js to refresh the live public shop
    revalidatePath("/shop");
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to publish" };
  }
}