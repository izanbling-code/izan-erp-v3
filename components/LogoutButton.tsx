"use client";

import { usePathname } from "next/navigation";

export default function LogoutButton() {
  const pathname = usePathname();

  // Hide the button completely on the login page
  if (pathname === "/login") {
    return null;
  }

  return (
    <a
      href="/api/auth/logout"
      className="fixed top-4 right-4 z-50 bg-slate-900 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md flex items-center gap-2 transition-all duration-200 text-sm border border-slate-700 hover:border-red-500"
    >
      <span>🚪</span> Logout
    </a>
  );
}