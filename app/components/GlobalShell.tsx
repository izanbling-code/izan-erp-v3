"use client";

import React from "react";
import Sidebar from "./Sidebar";
import { useERPConfig } from "@/app/contexts/SettingsContext";
import { usePathname } from "next/navigation";

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { config: appearanceConfig } = useERPConfig("appearance");
  
  if (pathname?.includes("/print")) {
    return (
      <div className="w-full min-h-screen bg-slate-200 print:bg-white text-slate-900">
        {children}
      </div>
    );
  }

  const isCompact = appearanceConfig?.dataDensity === "compact";
  const paddingClass = isCompact ? "p-4" : "p-8";

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-zinc-300 font-sans antialiased overflow-hidden transition-colors duration-300 print:h-auto print:bg-white print:text-black print:overflow-visible">
      {/* Hide Sidebar during print */}
      <div className="print:hidden shrink-0">
        <Sidebar />
      </div>
      
      {/* Allow main content to expand naturally on paper */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar print:overflow-visible print:h-auto">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-teal-600/10 via-slate-100/80 to-transparent dark:from-teal-500/5 dark:via-zinc-950/50 dark:to-transparent pointer-events-none -z-10 print:hidden" />
        
        {/* Strip padding for full-width print */}
        <div className={`max-w-[1600px] mx-auto w-full relative z-10 ${paddingClass} print:p-0 print:max-w-full`}>
          {children}
        </div>
      </main>
    </div>
  );
}
