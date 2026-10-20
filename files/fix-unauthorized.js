const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app/unauthorized/page.tsx");
if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");

    // 1. Strip the invalid export that pushed "use client" down
    content = content.replace(/export const dynamic = ['"]force-dynamic['"];?\r?\n?/g, "");

    // 2. Only apply the wrapper if it hasn't been applied yet
    if (content.includes("export default function UnauthorizedPage")) {
        
        // Ensure React Suspense is imported right after use client
        if (!content.includes("Suspense")) {
            content = content.replace(/"use client";\r?\n?/, "\"use client\";\nimport { Suspense } from \"react\";\n");
        }

        // Rename the original export so we can wrap it safely
        content = content.replace("export default function UnauthorizedPage", "function UnauthorizedContent");

        // Append the Suspense wrapper as the new default export
        content += `\n\nexport default function UnauthorizedPage() {\n  return (\n    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>\n      <UnauthorizedContent />\n    </Suspense>\n  );\n}\n`;

        fs.writeFileSync(filePath, content);
        console.log("Restored 'use client' and successfully wrapped UnauthorizedPage in Suspense.");
    }
}
