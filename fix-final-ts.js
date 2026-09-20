const fs = require("fs");
const path = require("path");

function removeTitlesAndFix(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, "utf8");
        
        // Remove title="..." or title={...} safely from these specific files
        content = content.replace(/\s+title=(['"]).*?\1/g, "");
        content = content.replace(/\s+title=\{.*?\}/g, "");
        
        fs.writeFileSync(fullPath, content);
        console.log("Fixed layout props in: " + filePath);
    }
}

const files = [
    "app/accounting/banking/[id]/page.tsx",
    "app/accounting/banking/[id]/reconcile/page.tsx",
    "app/accounting/banking/page.tsx",
    "app/accounting/cashbook/page.tsx",
    "app/accounting/closings/page.tsx",
    "app/accounting/opening-balances/page.tsx",
    "app/admin/withdrawals/page.tsx",
    "app/purchases/bills/page.tsx",
    "app/reports/page.tsx",
    "app/reports/view/[type]/page.tsx",
    "app/reports/view/bank-ledgers/page.tsx",
    "app/reports/view/cash-book/page.tsx",
    "app/reports/view/cash-deposits/page.tsx",
    "app/reports/view/invoice-payments/page.tsx"
];

files.forEach(removeTitlesAndFix);

const journalPath = path.join(process.cwd(), "app/api/journal/route.ts");
if (fs.existsSync(journalPath)) {
    let content = fs.readFileSync(journalPath, "utf8");
    content = content.replace(/tenantId:/g, "companyId:");
    fs.writeFileSync(journalPath, content);
    console.log("Fixed tenantId typo in Journal API");
}
