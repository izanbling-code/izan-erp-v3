import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const orders = await prisma.order.findMany({
      where: { 
        companyId: company.id,
        status: { notIn: ["DELIVERED", "RETURNED", "VOID"] },
        bookingNumber: { not: null }
      }
    });

    const activeOrders = orders.filter((o): o is typeof o & { bookingNumber: string } => Boolean(o.bookingNumber && o.bookingNumber.trim() !== ""));

    if (activeOrders.length === 0) return NextResponse.json({ message: "No active shipments to sync." });

    let updatedCount = 0;
    let invalidTrackings: string[] = [];

    for (const order of activeOrders) {
      const tracking = order.bookingNumber.trim();
      try {
        // Try the original URL without &type=0 first, as that previously returned valid JSON
        const response = await fetch(`https://sonic.pk/api/shipment/track?tracking_number=${tracking}`, {
          method: "GET",
          headers: {
            "Authorization": process.env.TRAX_API_KEY || "",
            "Content-Type": "application/json"
          }
        });

        // 1. Read the raw text BEFORE trying to parse it as JSON
        const rawText = await response.text();
        
        let traxData;
        try {
          // 2. Safely attempt to parse it
          traxData = JSON.parse(rawText);
        } catch (parseError) {
          // 3. If it fails, log the HTML so we can see the real error, and skip this order
          console.error(`\n--- TRAX RETURNED HTML INSTEAD OF JSON FOR ${tracking} ---`);
          console.error(`Status Code: ${response.status}`);
          console.error(`Preview: ${rawText.substring(0, 300)}...`);
          invalidTrackings.push(`${tracking} (API returned an HTML error page)`);
          continue; 
        }
        
        console.log(`\n--- TRAX RESPONSE FOR ${tracking} ---`);
        console.log(JSON.stringify(traxData, null, 2));

        if (
          !response.ok || 
          traxData?.status === 0 || 
          traxData?.errors || 
          traxData?.message?.toLowerCase().includes("error") ||
          traxData?.message?.toLowerCase().includes("invalid")
        ) {
          invalidTrackings.push(tracking);
          continue; 
        }

        const rawStatus = traxData?.status || traxData?.shipment_status || traxData?.data?.status || "";
        const currentStatus = String(rawStatus).toUpperCase();

        if (currentStatus === "DELIVERED" || currentStatus === "RETURNED") {
          const nextStatus = currentStatus === "DELIVERED" ? "DELIVERED" : "RETURNED";
          await prisma.order.update({
            where: { id: order.id },
            data: { 
              status: nextStatus,
              paymentStatus: nextStatus === "DELIVERED" ? "PAID" : order.paymentStatus 
            }
          });
          updatedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync Trax order ${tracking}:`, err);
        invalidTrackings.push(`${tracking} (Connection failed)`);
      }
    }

    let finalMessage = `Successfully synced ${updatedCount} orders.`;
    if (invalidTrackings.length > 0) {
      finalMessage += `\n\nWARNING: The following tracking IDs failed to sync: \n- ${invalidTrackings.join("\n- ")}`;
    }

    return NextResponse.json({ success: true, message: finalMessage });
  } catch (error: any) {
    console.error("Trax Sync Error:", error);
    return NextResponse.json({ error: "Failed to sync with Trax" }, { status: 500 });
  }
}
