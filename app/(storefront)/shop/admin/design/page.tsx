// app/(storefront)/shop/admin/design/page.tsx

import { prisma } from "@/app/lib/prisma";
import DesignEditor from "./DesignEditor";
import type { StorefrontSettingsV2 } from "./types";
import { DEFAULT_THEME, DEFAULT_HOME_TEMPLATE } from "./registry";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    // UPDATE THIS LINE: Include both storefront and storefrontDraft
    include: { companySettings: { select: { storefront: true, storefrontDraft: true } } }, 
  });

  // Load the draft first, fallback to live, then fallback to empty object
  const raw = (company?.companySettings?.storefrontDraft || company?.companySettings?.storefront as any) || {};
  
  const storefront: StorefrontSettingsV2 = {
    theme: raw.theme ?? DEFAULT_THEME,
    templates: raw.templates ?? {
      index: DEFAULT_HOME_TEMPLATE,
      product: { sections: [] },
      collection: { sections: [] },
      page: { sections: [] },
      cart: { sections: [] },
      notFound: { sections: [] },
    },
    pages: raw.pages,
    canvasElements: raw.canvasElements,
  };

  const products = await prisma.product.findMany({
    where: { companyId: company?.id ?? "", isActive: true },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      name: true,
      salePrice: true,
      compareAtPrice: true,
      imageUrl: true,
    },
  });

  return (
    <DesignEditor
      initialStorefront={storefront}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        salePrice: Number(p.salePrice),
        compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
        imageUrl: p.imageUrl,
      }))}
    />
  );
}