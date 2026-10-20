const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "app/unauthorized/page.tsx");
if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("force-dynamic")) {
        content = "export const dynamic = 'force-dynamic';\n" + content;
        fs.writeFileSync(filePath, content);
        console.log("Fixed useSearchParams error by forcing dynamic rendering.");
    }
} else {
    console.log("Could not find app/unauthorized/page.tsx. Please check the path.");
}
