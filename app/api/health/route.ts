import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const result = await prisma.$queryRaw<
      { now: Date }[]
    >`SELECT NOW() AS now`;

    return Response.json({
      ok: true,
      database: "connected",
      timestamp: result[0]?.now ?? null,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    return Response.json(
      {
        ok: false,
        database: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}