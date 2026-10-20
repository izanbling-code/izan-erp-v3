import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import StorefrontTemplate from "@/app/components/StorefrontTemplate";

export const dynamic = "force-dynamic";

type StorefrontPage = {
  rawHtml?: string;
  rawCss?: string;
};

export default async function CustomStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    include: { companySettings: true },
  });

  const storefront = company?.companySettings?.storefront as
    | { pages?: Record<string, StorefrontPage> }
    | null;
  const page = storefront?.pages?.[slug];

  if (!page?.rawHtml?.trim()) notFound();

  const products =
    page.rawHtml.includes("{{store.productGrid}}") ||
    page.rawHtml.includes("<storefront-product-grid")
      ? await prisma.product.findMany({
          where: {
            companyId: company?.id ?? "",
            type: { in: ["PRODUCT", "GOODS"] },
            isActive: true,
            isPublished: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <StorefrontTemplate
      html={page.rawHtml}
      css={page.rawCss}
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        salePrice: Number(product.salePrice),
        compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      }))}
    />
  );
}
