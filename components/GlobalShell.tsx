"use client";

import React from "react";
import Sidebar from "./Sidebar";
import { useERPConfig } from "@/app/contexts/SettingsContext";

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const { config: appearanceConfig } = useERPConfig("appearance");
  const isCompact = appearanceConfig?.dataDensity === "compact";
  const paddingClass = isCompact ? "p-4" : "p-8";

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-300 font-sans antialiased overflow-hidden transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-teal-500/5 to-transparent pointer-events-none -z-10" />
        <div className={`max-w-[1600px] mx-auto w-full ${paddingClass}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
