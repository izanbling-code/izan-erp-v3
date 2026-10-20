"use client";

import { usePathname } from "next/navigation";

const moduleNames: Record<string, string> = {
  "/": "Dashboard",
  "/sales": "Sales",
  "/purchases": "Purchases",
  "/inventory": "Inventory",
  "/accounting": "Accounting",
  "/reports": "Reports",
  "/settings": "Settings",
};

export default function Topbar() {
  const pathname = usePathname();

  const moduleKey =
    Object.keys(moduleNames)
      .filter(
        (key) =>
          pathname === key ||
          (key !== "/" &&
            pathname.startsWith(`${key}/`))
      )
      .sort((a, b) => b.length - a.length)[0] ?? "/";

  const moduleName = moduleNames[moduleKey];

  return (
    <>
      <div className="erp-topbar-left">
        <div className="erp-topbar-breadcrumb">
          <span>Izan Bling ERP</span>
          <span className="breadcrumb-separator">/</span>
          <span>{moduleName}</span>
        </div>

        <h1 className="erp-topbar-title">
          {moduleName}
        </h1>
      </div>

      <div className="erp-topbar-actions">
        <button
          type="button"
          className="erp-icon-button"
          aria-label="Notifications"
        >
          ♢
        </button>

        <div className="erp-topbar-divider" />

        <button
          type="button"
          className="erp-user-button"
        >
          <div className="erp-user-avatar">
            IB
          </div>

          <div className="erp-user-details">
            <strong>Administrator</strong>
            <small>Administrator</small>
          </div>

          <span className="erp-user-chevron">
            ˅
          </span>
        </button>
      </div>
    </>
  );
}