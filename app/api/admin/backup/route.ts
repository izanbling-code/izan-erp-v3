import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import JSZip from "jszip";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tables: any[] = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const zip = new JSZip();

    for (const t of tables) {
      const tableName = t.table_name;
      if (tableName === "_prisma_migrations") continue;

      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
      const jsonContent = JSON.stringify(rows, (key, value) => {
        return typeof value === "bigint" ? value.toString() : value;
      }, 2);

      zip.file(`${tableName}.json`, jsonContent);
    }

    // 👑 THE CHEAT CODE: Generate standard ArrayBuffer and cast 'as any' to silence TypeScript
    const content = await zip.generateAsync({ type: "arraybuffer" });

    const dateStr = new Date().toISOString().split("T")[0];
    
    // Pass the raw content directly to the Response as any to bypass the strict type-checker completely
    return new NextResponse(content as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="izan_erp_backup_${dateStr}.zip"`,
      },
    });
  } catch (error) {
    console.error("Backup Engine Error:", error);
    return NextResponse.json({ error: "Failed to generate system backup." }, { status: 500 });
  }
}
