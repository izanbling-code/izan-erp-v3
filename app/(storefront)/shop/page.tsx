import { prisma } from "@/app/lib/prisma";
import StorefrontTemplate from "@/app/components/StorefrontTemplate";
import StorefrontSectionRenderer from "@/app/components/StorefrontSectionRenderer";
import StorefrontFunnelPopup from "@/app/components/StorefrontFunnelPopup";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type StorefrontSettings = {
  theme?: any;
  templates?: Record<string, { sections: any[] }>;
  pages?: Record<string, { rawHtml?: string; rawCss?: string }>;
};

export default async function ShopPage() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: { companySettings: true },
  });

  const products = await prisma.product.findMany({
    where: {
      companyId: company?.id ?? "",
      type: { in: ["PRODUCT", "GOODS"] },
      isActive: true,
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const activeQuiz = await prisma.storefrontQuiz.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      nodes: {
        include: {
          choices: true,
        },
      },
    },
  });

  const settings = company?.companySettings?.storefront as StorefrontSettings | null;
  const homePage = settings?.pages?.home;
  const allSections = settings?.templates?.index?.sections ?? [];
  const v2Theme = settings?.theme;
  const hasV2 = allSections.length > 0;

  // Pull the welcome-funnel section out — it renders as a popup, not inline.
  const funnelSection = allSections.find(
    (s: any) => s.type === "welcome-funnel" && !s.disabled
  );
  const inlineSections = allSections.filter(
    (s: any) => s.type !== "welcome-funnel" && !s.disabled
  );

  const plainProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    salePrice: Number(p.salePrice),
    compareAtPrice: p.compareAtPrice !== null ? Number(p.compareAtPrice) : null,
  }));

  // Serialize the quiz so Prisma Decimals survive the server→client boundary.
  const plainQuiz = activeQuiz
    ? {
        id: activeQuiz.id,
        nodes: activeQuiz.nodes.map((n) => ({
          id: n.id,
          questionText: (n as any).questionText ?? "",
          subtitle: (n as any).subtitle ?? null,
          choices: n.choices.map((c) => ({
            id: c.id,
            text: c.text,
            nextNodeId: c.nextNodeId,
            resultProductId: c.resultProductId,
            resultUrl: c.resultUrl,
          })),
        })),
      }
    : null;

  const themeVars = (v2Theme
    ? {
        "--theme-primary": v2Theme.colors?.primary,
        "--theme-secondary": v2Theme.colors?.secondary,
        "--theme-accent": v2Theme.colors?.accent,
        "--theme-bg": v2Theme.colors?.background,
        "--theme-surface": v2Theme.colors?.surface,
        "--theme-text": v2Theme.colors?.text,
        "--theme-text-muted": v2Theme.colors?.textMuted,
        "--theme-border": v2Theme.colors?.border,
        "--theme-radius": v2Theme.borderRadius,
        "--theme-heading-font": v2Theme.typography?.headingFont,
        "--theme-body-font": v2Theme.typography?.bodyFont,
        "--theme-base-size": v2Theme.typography?.baseFontSize,
        "--theme-heading-weight": v2Theme.typography?.headingWeight,
      }
    : {}) as CSSProperties;

  return (
    <main className="w-full flex flex-col relative">
      {funnelSection && (
        <StorefrontFunnelPopup section={funnelSection} quizData={plainQuiz} />
      )}

      {hasV2 && (
        <div
          style={themeVars}
          className="w-full relative z-10 bg-[var(--theme-bg,#ffffff)] text-[var(--theme-text,#0f172a)]"
        >
          {inlineSections.map((section: any) => (
            <StorefrontSectionRenderer
              key={section.id}
              section={section}
              products={plainProducts}
            />
          ))}
        </div>
      )}

      {!hasV2 && homePage?.rawHtml?.trim() && (
        <div className="w-full relative z-10 bg-white">
          <StorefrontTemplate
            html={homePage.rawHtml}
            css={homePage.rawCss}
            products={plainProducts}
          />
        </div>
      )}
    </main>
  );
}