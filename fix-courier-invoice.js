const fs = require("fs");
const path = require("app/api/orders/confirm/route.ts"); // or check common order confirmation routes

// Let's check common locations for order confirmation / invoice generation
const possiblePaths = [
  "app/api/orders/confirm/route.ts",
  "app/api/orders/route.ts",
  "app/api/pipeline/route.ts"
];

let targetPath = possiblePaths.find(p => fs.existsSync(p));

if (targetPath) {
  let content = fs.readFileSync(targetPath, "utf8");
  
  // Look for prisma.salesInvoice.create
  if (content.includes("prisma.salesInvoice.create")) {
    // Check if courierId is missing in the create payload
    if (!content.includes("courierId:")) {
      content = content.replace(
        /data:\s*\{([^}]+)\}/g,
        (match, inner) => {
          if (inner.includes("total") && !inner.includes("courierId")) {
            return `data: {${inner},\n        courierId: order.courierId || null}`;
          }
          return match;
        }
      );
      fs.writeFileSync(targetPath, content, "utf8");
      console.log("Success! Added courierId mapping to invoice creation in " + targetPath);
    } else {
      console.log("courierId is already present in the create payload.");
    }
  } else {
    console.log("Could not find prisma.salesInvoice.create in " + targetPath);
  }
} else {
  console.log("Could not locate the order confirmation API route automatically.");
}
