const fs = require("fs");
const path = require("path");

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

files.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, "utf8");
        
        // Target any corrupted layout opening tag and reset it to a clean tag without broken props
        content = content.replace(/<(DashboardLayout|AdminLayout|Layout|AppLayout)[^<]*?>/g, "<$1>");
        
        fs.writeFileSync(fullPath, content);
        console.log("Restored clean layout tag in: " + filePath);
    }
});
